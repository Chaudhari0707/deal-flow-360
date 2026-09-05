import { eq, inArray, sql } from "drizzle-orm";

import type { InventoryAllocation, InventoryDemand } from "@/features/inventory/_types/inventory";
import { planFulfillment } from "@/features/inventory/planner";
import type { DbTransaction } from "@/lib/db/_types/database";
import { orders } from "@/lib/db/schema/commerce";
import { reservations, stocks, warehouses } from "@/lib/db/schema/inventory";
import type { Actor, QuoteLine } from "@/lib/domain/_types/domain";
import { audit } from "@/server/audit";
import { DomainError } from "@/server/errors";

export function stockDemand(lines: QuoteLine[]): InventoryDemand[] {
  const totals = new Map<string, number>();
  for (const line of lines.filter((l) => l.stockable))
    totals.set(line.productId, (totals.get(line.productId) ?? 0) + line.quantity);
  return [...totals].map(([productId, quantity]) => ({ productId, quantity }));
}

/** All inventory paths lock stock in the same order; caller locks its order first. */
export async function lockedStock(tx: DbTransaction, productIds: string[]) {
  if (productIds.length === 0) return [];
  const balances = await tx
    .select()
    .from(stocks)
    .where(inArray(stocks.productId, productIds))
    .orderBy(stocks.id)
    .for("update");
  const locations = await tx.select().from(warehouses);
  return balances.map((stock) => ({
    ...stock,
    available: stock.onHand - stock.reserved,
    shippingWeight: (locations.find((w) => w.id === stock.warehouseId)?.shippingWeight ?? 0) / 100,
    active: locations.find((w) => w.id === stock.warehouseId)?.active ?? false,
  }));
}

export async function addAllocations(
  tx: DbTransaction,
  orderId: string,
  allocations: InventoryAllocation[],
) {
  for (const allocation of allocations) {
    const [balance] = await tx
      .update(stocks)
      .set({
        reserved: sql`${stocks.reserved} + ${allocation.quantity}`,
        version: sql`${stocks.version} + 1`,
      })
      .where(
        sql`${stocks.productId} = ${allocation.productId} AND ${stocks.warehouseId} = ${allocation.warehouseId} AND ${stocks.onHand} - ${stocks.reserved} >= ${allocation.quantity}`,
      )
      .returning();
    if (!balance) throw new DomainError("Stock changed; reload the fulfillment plan", 409);
    await tx
      .insert(reservations)
      .values({ id: crypto.randomUUID(), orderId, ...allocation })
      .onConflictDoUpdate({
        target: [reservations.orderId, reservations.productId, reservations.warehouseId],
        set: { quantity: sql`${reservations.quantity} + ${allocation.quantity}` },
      });
  }
}

export async function reserveOrderStock(
  tx: DbTransaction,
  order: typeof orders.$inferSelect,
  actor: Actor,
) {
  const demand = stockDemand(order.lines);
  const balances = await lockedStock(
    tx,
    demand.map((d) => d.productId),
  );
  const existing = await tx.select().from(reservations).where(eq(reservations.orderId, order.id));
  if (existing.length > 0) return;
  const plan = planFulfillment(
    demand,
    balances.filter((b) => b.active),
  );
  await addAllocations(tx, order.id, plan.allocations);
  await tx
    .update(orders)
    .set({
      fulfillmentStatus:
        demand.length === 0 ? "FULFILLED" : plan.backorders.length ? "BACKORDER" : "SPLIT_PENDING",
    })
    .where(eq(orders.id, order.id));
  await audit(tx, actor, order.id, "STOCK_RESERVED", "Reserved available stock at confirmation", {
    allocations: plan.allocations,
    backorders: plan.backorders,
  });
  return plan;
}

export async function lockOrder(tx: DbTransaction, orderId: string) {
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
  if (!order) throw new DomainError("Order not found", 404);
  return order;
}

export async function fulfillmentStatus(tx: DbTransaction, order: typeof orders.$inferSelect) {
  const demand = stockDemand(order.lines);
  const allocated = await tx.select().from(reservations).where(eq(reservations.orderId, order.id));
  const backorder = demand.some(
    (line) =>
      allocated
        .filter((r) => r.productId === line.productId)
        .reduce((sum, r) => sum + r.quantity, 0) < line.quantity,
  );
  const pending = allocated.some((r) => r.quantity > r.shipped);
  const status = backorder
    ? "BACKORDER"
    : pending
      ? order.acceptedAt
        ? "READY"
        : "SPLIT_PENDING"
      : "FULFILLED";
  await tx.update(orders).set({ fulfillmentStatus: status }).where(eq(orders.id, order.id));
  return status;
}
