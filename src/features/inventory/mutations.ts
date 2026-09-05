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
import { orders, products } from "@/lib/db/schema/commerce";
import { reservations, stockMovements, stocks, warehouses } from "@/lib/db/schema/inventory";
import type { Actor } from "@/lib/domain/_types/domain";
import { audit } from "@/server/audit";
import { DomainError } from "@/server/errors";

export async function acceptSplit(orderId: string, actor: Actor) {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (order.fulfillmentStatus === "FULFILLED")
      throw new DomainError("This order is already fulfilled.", 409);
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
    if (order.fulfillmentStatus === "FULFILLED")
      throw new DomainError("This order is already fulfilled.", 409);
    if (order.fulfillmentStatus === "SPLIT_PENDING")
      throw new DomainError("Accept the shipment before changing reservations.", 409);
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
    if (order.fulfillmentStatus === "FULFILLED")
      throw new DomainError("This order is already fulfilled.", 409);
    const demand = stockDemand(order.lines);
    const balances = await lockedStock(
      tx,
      demand.map((line) => line.productId),
    );
    const existing = await tx.select().from(reservations).where(eq(reservations.orderId, orderId));
    const remaining = demand
      .map((line) => ({
        ...line,
        quantity:
          line.quantity -
          existing
            .filter((r) => r.productId === line.productId)
            .reduce((sum, r) => sum + r.quantity, 0),
      }))
      .filter((line) => line.quantity > 0);
    const supply = balances.filter((balance) => balance.active && balance.available > 0);
    if (remaining.length === 0)
      return {
        allocations: [],
        backorders: [],
        shipmentCount: 0,
        shippingScore: 0,
        status: await fulfillmentStatus(tx, order),
      };
    if (supply.length === 0)
      throw new DomainError(
        "No available stock at active warehouses for the remaining products. Receive stock on Inventory, then try again.",
        409,
      );
    let plan;
    try {
      plan = planFulfillment(remaining, supply);
    } catch (error) {
      throw new DomainError(
        error instanceof Error ? error.message : "Unable to allocate remaining backorder",
        409,
      );
    }
    if (plan.allocations.length === 0)
      throw new DomainError(
        "No available stock at active warehouses for the remaining products. Receive stock on Inventory, then try again.",
        409,
      );
    await addAllocations(tx, orderId, plan.allocations);
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
    let balances = await lockedStock(tx, [input.productId]);
    let balance = balances.find((b) => b.warehouseId === input.warehouseId);
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
    if (!balance) {
      const [product] = await tx.select().from(products).where(eq(products.id, input.productId));
      if (!product?.stockable) throw new DomainError("Choose a stockable product", 400);
      const [location] = await tx
        .select()
        .from(warehouses)
        .where(eq(warehouses.id, input.warehouseId));
      if (!location) throw new DomainError("Warehouse not found", 404);
      await tx
        .insert(stocks)
        .values({
          id: crypto.randomUUID(),
          onHand: 0,
          productId: input.productId,
          reserved: 0,
          warehouseId: input.warehouseId,
        })
        .onConflictDoNothing();
      balances = await lockedStock(tx, [input.productId]);
      balance = balances.find((b) => b.warehouseId === input.warehouseId);
      if (!balance) throw new DomainError("Warehouse not found", 404);
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
    if (!order.acceptedAt) throw new DomainError("Accept the shipment before shipping", 409);
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
    if (order.fulfillmentStatus === "FULFILLED")
      throw new DomainError("This order is already fulfilled.", 409);
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
    await fulfillmentStatus(tx, order);
    return { movementId: id, repeated: false };
  });
}
