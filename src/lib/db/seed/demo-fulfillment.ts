import { eq } from "drizzle-orm";

import { createOrderBilling } from "@/features/billing/creation";
import { calculateQuote, priceLines } from "@/features/quotes/rules";
import type { DbTransaction } from "@/lib/db/_types/database";
import * as s from "@/lib/db/schema";
import { customerRows, productRows } from "@/lib/db/seed/demo-data";
import type { QuoteLine } from "@/lib/domain/_types/domain";

type StageOrder = {
  accepted?: boolean;
  allocations?: { productId: string; quantity: number; shipped?: number; warehouseId: string }[];
  customerId: string;
  id: string;
  lines: { discountBps: number; productId: string; quantity: number }[];
  status: "BACKORDER" | "FULFILLED" | "READY" | "SPLIT_PENDING";
};

const stageOrders: StageOrder[] = [
  {
    allocations: [{ productId: "mouse", quantity: 5, warehouseId: "main" }],
    customerId: "acme",
    id: "Q-FA1",
    lines: [{ discountBps: 0, productId: "mouse", quantity: 5 }],
    status: "SPLIT_PENDING",
  },
  {
    allocations: [{ productId: "dock", quantity: 3, warehouseId: "main" }],
    customerId: "beta",
    id: "Q-FA2",
    lines: [{ discountBps: 0, productId: "dock", quantity: 3 }],
    status: "SPLIT_PENDING",
  },
  {
    allocations: [{ productId: "mouse", quantity: 2, warehouseId: "main" }],
    customerId: "nova",
    id: "Q-FA3",
    lines: [{ discountBps: 0, productId: "mouse", quantity: 2 }],
    status: "SPLIT_PENDING",
  },
  {
    allocations: [{ productId: "dock", quantity: 2, warehouseId: "east" }],
    customerId: "zenith",
    id: "Q-FA4",
    lines: [{ discountBps: 0, productId: "dock", quantity: 2 }],
    status: "SPLIT_PENDING",
  },
  {
    allocations: [{ productId: "mouse", quantity: 4, warehouseId: "main" }],
    customerId: "delta",
    id: "Q-FA5",
    lines: [{ discountBps: 0, productId: "mouse", quantity: 4 }],
    status: "SPLIT_PENDING",
  },
  {
    accepted: true,
    allocations: [{ productId: "mouse", quantity: 6, warehouseId: "main" }],
    customerId: "acme",
    id: "Q-FR1",
    lines: [{ discountBps: 0, productId: "mouse", quantity: 6 }],
    status: "READY",
  },
  {
    accepted: true,
    allocations: [{ productId: "dock", quantity: 4, warehouseId: "main" }],
    customerId: "beta",
    id: "Q-FR2",
    lines: [{ discountBps: 0, productId: "dock", quantity: 4 }],
    status: "READY",
  },
  {
    accepted: true,
    allocations: [{ productId: "mouse", quantity: 3, warehouseId: "main" }],
    customerId: "nova",
    id: "Q-FR3",
    lines: [{ discountBps: 0, productId: "mouse", quantity: 3 }],
    status: "READY",
  },
  {
    accepted: true,
    allocations: [{ productId: "laptop16", quantity: 2, warehouseId: "main" }],
    customerId: "zenith",
    id: "Q-FR4",
    lines: [{ discountBps: 0, productId: "laptop16", quantity: 2 }],
    status: "READY",
  },
  {
    accepted: true,
    allocations: [{ productId: "dock", quantity: 1, warehouseId: "east" }],
    customerId: "delta",
    id: "Q-FR5",
    lines: [{ discountBps: 0, productId: "dock", quantity: 1 }],
    status: "READY",
  },
  {
    customerId: "orion",
    id: "Q-FB3",
    lines: [{ discountBps: 500, productId: "laptop13", quantity: 12 }],
    status: "BACKORDER",
  },
  {
    accepted: true,
    allocations: [{ productId: "laptop16", quantity: 10, warehouseId: "main" }],
    customerId: "harbor",
    id: "Q-FB4",
    lines: [{ discountBps: 0, productId: "laptop16", quantity: 20 }],
    status: "BACKORDER",
  },
  {
    accepted: true,
    allocations: [
      { productId: "dock", quantity: 58, warehouseId: "main" },
      { productId: "dock", quantity: 5, warehouseId: "east" },
    ],
    customerId: "northwind",
    id: "Q-FB5",
    lines: [{ discountBps: 0, productId: "dock", quantity: 80 }],
    status: "BACKORDER",
  },
  {
    accepted: true,
    customerId: "acme",
    id: "Q-FF1",
    lines: [{ discountBps: 800, productId: "setup", quantity: 1 }],
    status: "FULFILLED",
  },
];

export async function seedFulfillmentStages(tx: DbTransaction, repId: string) {
  const [existing] = await tx
    .select({ id: s.quotes.id })
    .from(s.quotes)
    .where(eq(s.quotes.id, "Q-FA1"));
  if (existing) return;
  const now = new Date();
  const ago = (days: number) => new Date(now.getTime() - days * 86400000);
  for (const fixture of stageOrders) {
    const customer = customerRows.find((row) => row.id === fixture.customerId);
    if (!customer) continue;
    const values = calculateQuote(
      priceLines(productRows, customer.tier, fixture.lines),
      0,
      customer.tier,
    );
    await tx.insert(s.quotes).values({
      id: fixture.id,
      number: fixture.id,
      customerId: customer.id,
      ownerId: repId,
      ...values,
      status: "CONFIRMED",
      revision: 1,
      approvedRevision: 1,
      createdAt: ago(8),
      updatedAt: ago(1),
      promisedDate: ago(-3).toISOString().slice(0, 10),
    });
    await tx.insert(s.quoteRevisions).values({
      id: `rev-${fixture.id}`,
      quoteId: fixture.id,
      revision: 1,
      lines: values.lines,
      riskSnapshot: values.riskSnapshot,
    });
    const [order] = await tx
      .insert(s.orders)
      .values({
        id: `order-${fixture.id}`,
        quoteId: fixture.id,
        number: fixture.id.replace("Q-", "SO-"),
        customerId: customer.id,
        lines: values.lines as QuoteLine[],
        createdAt: ago(8),
        promisedDate: ago(-3).toISOString().slice(0, 10),
        fulfillmentStatus: fixture.status,
        acceptedAt: fixture.accepted ? ago(1) : null,
      })
      .returning();
    if (order) await createOrderBilling(tx, order, ago(8));
    if (fixture.allocations?.length)
      await tx.insert(s.reservations).values(
        fixture.allocations.map((row) => ({
          id: `${fixture.id}-${row.warehouseId}-${row.productId}`,
          orderId: `order-${fixture.id}`,
          productId: row.productId,
          warehouseId: row.warehouseId,
          quantity: row.quantity,
          shipped: row.shipped ?? 0,
        })),
      );
  }
  await tx.update(s.stocks).set({ reserved: 20 }).where(eq(s.stocks.id, "main-mouse"));
  await tx.update(s.stocks).set({ onHand: 65, reserved: 65 }).where(eq(s.stocks.id, "main-dock"));
  await tx.update(s.stocks).set({ onHand: 8, reserved: 8 }).where(eq(s.stocks.id, "east-dock"));
  await tx
    .update(s.stocks)
    .set({ onHand: 12, reserved: 12 })
    .where(eq(s.stocks.id, "main-laptop16"));
}
