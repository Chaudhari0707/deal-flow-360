import { and, eq, sql } from "drizzle-orm";

import { createOrderBilling } from "@/features/billing/creation";
import { calculateQuote, priceLines } from "@/features/quotes/rules";
import type { DbTransaction } from "@/lib/db/_types/database";
import * as s from "@/lib/db/schema";
import { customerRows, productRows } from "@/lib/db/seed/demo-data";

export const BACKORDER_QUOTE_IDS = new Set(["Q-1024", "Q-1022"]);
export const FULFILLED_HARDWARE_QUOTE_ID = "Q-1021";
export const FULFILLED_HARDWARE_ORDER_ID = `order-${FULFILLED_HARDWARE_QUOTE_ID}`;
export const FULFILLED_HARDWARE_CUSTOMER_ID = "zenith";

export const fulfilledHardwareLines = [
  { productId: "dock", quantity: 2, discountBps: 0 },
  { productId: "mouse", quantity: 4, discountBps: 0 },
];

export const fulfilledHardwareShipments = [
  {
    reservationId: "zenith-main-dock",
    productId: "dock",
    warehouseId: "main",
    quantity: 2,
    movementId: "seed-ship-zenith-dock",
    operationKey: "seed-ship-order-Q-1021-dock-main",
  },
  {
    reservationId: "zenith-main-mouse",
    productId: "mouse",
    warehouseId: "main",
    quantity: 4,
    movementId: "seed-ship-zenith-mouse",
    operationKey: "seed-ship-order-Q-1021-mouse-main",
  },
] as const;

export function demoStockRows() {
  return [
    { id: "main-laptop", warehouseId: "main", productId: "laptop", onHand: 40, reserved: 18 },
    { id: "east-laptop", warehouseId: "east", productId: "laptop", onHand: 10, reserved: 6 },
    { id: "west-laptop", warehouseId: "west", productId: "laptop", onHand: 4, reserved: 0 },
    { id: "east-laptop13", warehouseId: "east", productId: "laptop13", onHand: 4, reserved: 4 },
    { id: "main-mouse", warehouseId: "main", productId: "mouse", onHand: 196, reserved: 0 },
    { id: "main-dock", warehouseId: "main", productId: "dock", onHand: 63, reserved: 0 },
    { id: "east-dock", warehouseId: "east", productId: "dock", onHand: 8, reserved: 0 },
    { id: "main-laptop16", warehouseId: "main", productId: "laptop16", onHand: 12, reserved: 0 },
  ];
}

export async function insertDemoFulfillmentFacts(
  tx: DbTransaction,
  opsId: string,
  shippedAt: Date,
) {
  await tx
    .insert(s.reservations)
    .values([
      {
        id: "harbor-main",
        orderId: "order-Q-1024",
        productId: "laptop",
        warehouseId: "main",
        quantity: 18,
      },
      {
        id: "harbor-east",
        orderId: "order-Q-1024",
        productId: "laptop",
        warehouseId: "east",
        quantity: 6,
      },
      {
        id: "northwind-east",
        orderId: "order-Q-1022",
        productId: "laptop13",
        warehouseId: "east",
        quantity: 4,
      },
      ...fulfilledHardwareShipments.map((ship) => ({
        id: ship.reservationId,
        orderId: FULFILLED_HARDWARE_ORDER_ID,
        productId: ship.productId,
        warehouseId: ship.warehouseId,
        quantity: ship.quantity,
        shipped: ship.quantity,
      })),
    ])
    .onConflictDoNothing();
  await tx
    .insert(s.stockMovements)
    .values(
      fulfilledHardwareShipments.map((ship) => ({
        id: ship.movementId,
        actorId: opsId,
        createdAt: shippedAt,
        kind: "SHIP",
        operationKey: ship.operationKey,
        orderId: FULFILLED_HARDWARE_ORDER_ID,
        productId: ship.productId,
        quantity: ship.quantity,
        reason: "Warehouse dispatch",
        warehouseId: ship.warehouseId,
      })),
    )
    .onConflictDoNothing();
  await tx
    .update(s.orders)
    .set({ acceptedAt: shippedAt, fulfillmentStatus: "FULFILLED" })
    .where(eq(s.orders.id, FULFILLED_HARDWARE_ORDER_ID));
}

export async function ensureFulfilledHardwareQuote(
  tx: DbTransaction,
  ctx: { now: Date; repId: string },
): Promise<"created" | "existed"> {
  const [existing] = await tx
    .select({ id: s.quotes.id })
    .from(s.quotes)
    .where(eq(s.quotes.id, FULFILLED_HARDWARE_QUOTE_ID));
  if (existing) return "existed";
  const customer = customerRows.find((row) => row.id === FULFILLED_HARDWARE_CUSTOMER_ID);
  if (!customer) throw new Error("Zenith customer is required for the fulfilled hardware seed");
  const ago = (days: number) => new Date(ctx.now.getTime() - days * 86400000);
  const values = calculateQuote(
    priceLines(productRows, customer.tier, fulfilledHardwareLines),
    0,
    customer.tier,
  );
  const [quote] = await tx
    .insert(s.quotes)
    .values({
      id: FULFILLED_HARDWARE_QUOTE_ID,
      number: FULFILLED_HARDWARE_QUOTE_ID,
      customerId: customer.id,
      ownerId: ctx.repId,
      ...values,
      status: "CONFIRMED",
      revision: 1,
      approvedRevision: 1,
      approvalStep: null,
      createdAt: ago(12),
      updatedAt: ago(1),
      promisedDate: ago(2).toISOString().slice(0, 10),
    })
    .returning();
  await tx.insert(s.quoteRevisions).values({
    id: crypto.randomUUID(),
    quoteId: FULFILLED_HARDWARE_QUOTE_ID,
    revision: 1,
    lines: values.lines,
    riskSnapshot: values.riskSnapshot,
  });
  await tx.insert(s.auditEntries).values({
    id: crypto.randomUUID(),
    entityId: FULFILLED_HARDWARE_QUOTE_ID,
    actorId: ctx.repId,
    actorName: "Jordan Rao",
    action: "QUOTE_SUBMITTED",
    reason: `Risk ${values.risk}`,
    revision: 1,
    detail: { risk: values.riskSnapshot },
    createdAt: ago(12),
  });
  if (values.risk === "NONE")
    await tx.insert(s.auditEntries).values({
      id: crypto.randomUUID(),
      entityId: FULFILLED_HARDWARE_QUOTE_ID,
      actorId: null,
      actorName: "Automatic approval",
      action: "AUTO_APPROVED",
      reason: "All discounts are within policy",
      revision: 1,
      createdAt: ago(12),
    });
  const [order] = await tx
    .insert(s.orders)
    .values({
      id: FULFILLED_HARDWARE_ORDER_ID,
      quoteId: FULFILLED_HARDWARE_QUOTE_ID,
      number: FULFILLED_HARDWARE_QUOTE_ID.replace("Q-", "SO-"),
      customerId: customer.id,
      lines: values.lines,
      createdAt: ago(10),
      promisedDate: quote!.promisedDate,
      fulfillmentStatus: "FULFILLED",
      acceptedAt: ago(8),
    })
    .returning();
  await createOrderBilling(tx, order!, ago(10));
  await tx
    .update(s.invoices)
    .set({ createdAt: ago(10) })
    .where(eq(s.invoices.orderId, order!.id));
  return "created";
}

export async function consumeFulfilledHardwareStock(tx: DbTransaction) {
  for (const ship of fulfilledHardwareShipments) {
    await tx
      .update(s.stocks)
      .set({ onHand: sql`${s.stocks.onHand} - ${ship.quantity}` })
      .where(
        and(eq(s.stocks.productId, ship.productId), eq(s.stocks.warehouseId, ship.warehouseId)),
      );
  }
}
