import { expect, test } from "bun:test";

import { eq } from "drizzle-orm";

import { createOrderBilling } from "@/features/billing/creation";
import { db } from "@/lib/db/connection";
import {
  auditEntries,
  customers,
  invoices,
  orders,
  products,
  quotes,
  subscriptions,
  user,
} from "@/lib/db/schema";
import type { QuoteLine } from "@/lib/domain/_types/domain";

async function successfulRun() {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch("http://127.0.0.1:43102/health", {
        signal: AbortSignal.timeout(500),
      });
      const health = (await response.json()) as {
        billing: { enabled: boolean; failed: boolean; lastSuccessAt: string | null };
      };
      if (health.billing.failed) throw new Error("Automatic scheduler reported a failed run");
      if (health.billing.enabled && health.billing.lastSuccessAt) return health;
    } catch (error) {
      if (error instanceof Error && error.message.includes("reported a failed run")) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Automatic scheduler did not report a completed run");
}

async function startAndCompleteRun() {
  const child = Bun.spawn(["bun", "run", "scripts/realtime.ts"], {
    cwd: import.meta.dir.replace(/[\\/]test[\\/]integration$/, ""),
    env: {
      ...Object.fromEntries(
        Object.entries(Bun.env).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      ),
      AUTOMATIC_BILLING: "true",
      REALTIME_PORT: "43102",
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  try {
    return await Promise.race([
      successfulRun(),
      child.exited.then(() => {
        throw new Error("Companion exited before completing billing");
      }),
    ]);
  } finally {
    child.kill("SIGTERM");
    await child.exited;
  }
}

test("automatic billing resumes due work on companion startup and restart cannot duplicate a period", async () => {
  if (!new URL(Bun.env.DATABASE_URL!).pathname.endsWith("_test"))
    throw new Error("Scheduler integration requires a dedicated _test database");
  const id = crypto.randomUUID();
  const now = new Date();
  const priorMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    .toISOString()
    .slice(0, 10);
  const line: QuoteLine = {
    category: "Subscription",
    costCents: 0,
    discountBps: 0,
    id,
    intervalMonths: 1,
    name: "Scheduler acceptance service",
    netCents: 4600,
    priceCents: 4600,
    productId: id,
    quantity: 1,
    stockable: false,
    taxBps: 0,
    taxCents: 0,
    totalCents: 4600,
    variant: "Standard",
  };
  try {
    await db.transaction(async (tx) => {
      await tx.insert(user).values({
        id,
        name: "Scheduler fixture",
        email: `scheduler-${id}@example.test`,
        createdAt: now,
        updatedAt: now,
      });
      await tx
        .insert(customers)
        .values({ id, name: "Scheduler customer", email: `scheduler-customer-${id}@example.test` });
      await tx.insert(products).values({
        id,
        name: line.name,
        category: line.category,
        costCents: 0,
        priceCents: 4600,
        intervalMonths: 1,
      });
      await tx.insert(quotes).values({
        id,
        number: `Q-${id}`,
        customerId: id,
        ownerId: id,
        status: "CONFIRMED",
        lines: [line],
      });
      const [order] = await tx
        .insert(orders)
        .values({
          id,
          number: `SO-${id}`,
          quoteId: id,
          customerId: id,
          fulfillmentStatus: "FULFILLED",
          lines: [line],
        })
        .returning();
      await createOrderBilling(tx, order!, priorMonth);
    });
    const initial = await db.select().from(invoices).where(eq(invoices.orderId, id));
    expect(initial).toHaveLength(1);
    const health = await startAndCompleteRun();
    expect(health.billing.failed).toBe(false);
    const first = await db
      .select()
      .from(invoices)
      .where(eq(invoices.orderId, id))
      .orderBy(invoices.periodStart);
    expect(first).toHaveLength(2);
    expect(
      first
        .filter((invoice) => invoice.periodStart === thisMonth)
        .map((invoice) => invoice.totalCents),
    ).toEqual([4600]);
    const [renewed] = await db.select().from(subscriptions).where(eq(subscriptions.orderId, id));
    expect(renewed?.periodEnd).toBe(nextMonth);
    const events = await db
      .select()
      .from(auditEntries)
      .where(eq(auditEntries.entityId, renewed!.id));
    expect(
      events
        .filter((event) => event.action === "BILLING_RUN")
        .map((event) => ({ actorId: event.actorId, actorName: event.actorName })),
    ).toEqual([{ actorId: null, actorName: "Automatic billing" }]);
    await startAndCompleteRun();
    const afterRestart = await db
      .select()
      .from(invoices)
      .where(eq(invoices.orderId, id))
      .orderBy(invoices.periodStart);
    expect(afterRestart).toEqual(first);
    expect(
      await db.select().from(auditEntries).where(eq(auditEntries.entityId, renewed!.id)),
    ).toEqual(events);
  } finally {
    await db.transaction(async (tx) => {
      await tx.delete(auditEntries).where(eq(auditEntries.entityId, `${id}:${id}`));
      await tx.delete(invoices).where(eq(invoices.orderId, id));
      await tx.delete(subscriptions).where(eq(subscriptions.orderId, id));
      await tx.delete(orders).where(eq(orders.id, id));
      await tx.delete(quotes).where(eq(quotes.id, id));
      await tx.delete(products).where(eq(products.id, id));
      await tx.delete(customers).where(eq(customers.id, id));
      await tx.delete(user).where(eq(user.id, id));
    });
  }
}, 20000);
