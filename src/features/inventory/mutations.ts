import { and, eq, sql } from "drizzle-orm";

import type { InventoryAllocation } from "@/features/inventory/_types/inventory";
import { validateOverride } from "@/features/inventory/override";
import { planFulfillment } from "@/features/inventory/planner";
import {
  addAllocations,
  fulfillmentStatus,
  lockedStock,
  lockOrder,
  stockDemand,
} from "@/features/inventory/stock";
import { db } from "@/lib/db/connection";
import { orders } from "@/lib/db/schema/commerce";
import { reservations, stockMovements, stocks } from "@/lib/db/schema/inventory";
import type { Actor } from "@/lib/domain/_types/domain";
import { audit } from "@/server/audit";
import { DomainError } from "@/server/errors";

export async function acceptSplit(orderId: string, actor: Actor) {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (order.acceptedAt) return order;
    const [updated] = await tx
      .update(orders)
      .set({ acceptedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();
    const status = await fulfillmentStatus(tx, updated!);
    await audit(
      tx,
      actor,
      orderId,
      "SPLIT_ACCEPTED",
      "Accepted existing reservations; no additional stock reserved",
    );
    return { ...updated, fulfillmentStatus: status };
  });
}

export async function overrideSplit(
  orderId: string,
  proposed: InventoryAllocation[],
  reason: string,
  actor: Actor,
) {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    const demand = stockDemand(order.lines);
    const balances = await lockedStock(
      tx,
      demand.map((line) => line.productId),
    );
    const existing = await tx.select().from(reservations).where(eq(reservations.orderId, orderId));
    const remaining = demand.map((line) => ({
      ...line,
      quantity:
        line.quantity -
        existing
          .filter((r) => r.productId === line.productId)
          .reduce((sum, r) => sum + r.shipped, 0),
    }));
    const pending = existing
      .filter((r) => r.quantity > r.shipped)
      .map((r) => ({
        productId: r.productId,
        quantity: r.quantity - r.shipped,
        warehouseId: r.warehouseId,
      }));
    try {
      validateOverride(
        remaining,
        balances.filter((b) => b.active),
        pending,
        proposed,
      );
    } catch (error) {
      throw new DomainError(error instanceof Error ? error.message : "Invalid override", 409);
    }
    const canonical = (lines: InventoryAllocation[]) =>
      JSON.stringify(
        lines
          .toSorted(
            (a, b) =>
              a.productId.localeCompare(b.productId) || a.warehouseId.localeCompare(b.warehouseId),
          )
          .map((line) => [line.productId, line.warehouseId, line.quantity]),
      );
    if (canonical(pending) === canonical(proposed)) return { status: order.fulfillmentStatus };
    for (const line of pending)
      await tx
        .update(stocks)
        .set({
          reserved: sql`${stocks.reserved} - ${line.quantity}`,
          version: sql`${stocks.version} + 1`,
        })
        .where(and(eq(stocks.productId, line.productId), eq(stocks.warehouseId, line.warehouseId)));
    await tx
      .update(reservations)
      .set({ quantity: sql`${reservations.shipped}` })
      .where(eq(reservations.orderId, orderId));
    await addAllocations(tx, orderId, proposed);
    await audit(tx, actor, orderId, "SPLIT_OVERRIDDEN", reason, {
      before: pending,
      after: proposed,
    });
    return { status: await fulfillmentStatus(tx, order) };
  });
}

export async function consolidateBackorder(orderId: string, actor: Actor) {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    const demand = stockDemand(order.lines);
    const balances = await lockedStock(
      tx,
      demand.map((line) => line.productId),
    );
    const existing = await tx.select().from(reservations).where(eq(reservations.orderId, orderId));
    const remaining = demand.map((line) => ({
      ...line,
      quantity:
        line.quantity -
        existing
          .filter((r) => r.productId === line.productId)
          .reduce((sum, r) => sum + r.quantity, 0),
    }));
    const plan = planFulfillment(
      remaining,
      balances.filter((b) => b.active),
    );
    await addAllocations(tx, orderId, plan.allocations);
    if (plan.allocations.length)
      await audit(
        tx,
        actor,
        orderId,
        "BACKORDER_CONSOLIDATED",
        "Allocated remaining demand after stock became available",
        { allocations: plan.allocations },
      );
    return { ...plan, status: await fulfillmentStatus(tx, order) };
  });
}

export async function restock(
  input: {
    operationKey: string;
    productId: string;
    quantity: number;
    reason: string;
    warehouseId: string;
  },
  actor: Actor,
) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.operationKey}, 0))`);
    const balances = await lockedStock(tx, [input.productId]);
    const balance = balances.find((b) => b.warehouseId === input.warehouseId);
    if (!balance)
      throw new DomainError(
        "Stock balance not found; configure the product at this warehouse first",
        404,
      );
    const [prior] = await tx
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.operationKey, input.operationKey));
    if (prior) {
      if (
        prior.kind !== "RESTOCK" ||
        prior.productId !== input.productId ||
        prior.warehouseId !== input.warehouseId ||
        prior.quantity !== input.quantity ||
        prior.reason !== input.reason
      )
        throw new DomainError("Operation key was already used with different inputs", 409);
      return { movementId: prior.id, repeated: true };
    }
    const id = crypto.randomUUID();
    await tx
      .update(stocks)
      .set({
        onHand: sql`${stocks.onHand} + ${input.quantity}`,
        version: sql`${stocks.version} + 1`,
      })
      .where(eq(stocks.id, balance.id));
    await tx.insert(stockMovements).values({ id, ...input, actorId: actor.id, kind: "RESTOCK" });
    await audit(tx, actor, input.warehouseId, "STOCK_RESTOCKED", input.reason, {
      productId: input.productId,
      quantity: input.quantity,
    });
    return { movementId: id, repeated: false };
  });
}

export async function shipReservation(
  orderId: string,
  input: { operationKey: string; quantity: number; reservationId: string },
  actor: Actor,
) {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (!order.acceptedAt) throw new DomainError("Accept the split before shipping", 409);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.operationKey}, 0))`);
    await lockedStock(
      tx,
      stockDemand(order.lines).map((l) => l.productId),
    );
    const [reservation] = await tx
      .select()
      .from(reservations)
      .where(and(eq(reservations.id, input.reservationId), eq(reservations.orderId, orderId)));
    if (!reservation) throw new DomainError("Reservation not found", 404);
    const [prior] = await tx
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.operationKey, input.operationKey));
    if (prior) {
      if (
        prior.kind !== "SHIP" ||
        prior.orderId !== orderId ||
        prior.productId !== reservation.productId ||
        prior.warehouseId !== reservation.warehouseId ||
        prior.quantity !== input.quantity
      )
        throw new DomainError("Operation key was already used with different inputs", 409);
      return { movementId: prior.id, repeated: true };
    }
    if (input.quantity > reservation.quantity - reservation.shipped)
      throw new DomainError("Shipment exceeds unshipped reservation", 409);
    await tx
      .update(stocks)
      .set({
        onHand: sql`${stocks.onHand} - ${input.quantity}`,
        reserved: sql`${stocks.reserved} - ${input.quantity}`,
        version: sql`${stocks.version} + 1`,
      })
      .where(
        and(
          eq(stocks.productId, reservation.productId),
          eq(stocks.warehouseId, reservation.warehouseId),
        ),
      );
    await tx
      .update(reservations)
      .set({ shipped: sql`${reservations.shipped} + ${input.quantity}` })
      .where(eq(reservations.id, reservation.id));
    const id = crypto.randomUUID();
    await tx.insert(stockMovements).values({
      id,
      actorId: actor.id,
      kind: "SHIP",
      operationKey: input.operationKey,
      orderId,
      productId: reservation.productId,
      quantity: input.quantity,
      reason: "Warehouse dispatch",
      warehouseId: reservation.warehouseId,
    });
    await audit(tx, actor, orderId, "STOCK_SHIPPED", "Warehouse dispatch", {
      reservationId: reservation.id,
      quantity: input.quantity,
    });
    return { movementId: id, repeated: false, status: await fulfillmentStatus(tx, order) };
  });
}
