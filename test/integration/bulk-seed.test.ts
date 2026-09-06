import { afterAll, beforeAll, expect, test } from "bun:test";

import { and, count, eq, like } from "drizzle-orm";

import { createAuth } from "@/lib/auth/create-auth";
import { db } from "@/lib/db/connection";
import * as s from "@/lib/db/schema";
import { seedBulkData } from "@/lib/db/seed/bulk";

const previousPassword = Bun.env.DEMO_PASSWORD;
const password = `Test-${crypto.randomUUID()}`;
const batch = `test-${crypto.randomUUID().slice(0, 8)}`;
const options = { batch, count: 100, asOf: "2026-09-06" };
const prefix = `bulk-${batch}-`;

beforeAll(async () => {
  if (!new URL(Bun.env.DATABASE_URL!).pathname.endsWith("_test"))
    throw new Error("Isolated _test database required");
  Bun.env.DEMO_PASSWORD = password;
  for (const role of ["rep", "finance", "ops"] as const) {
    const email = `${role}@dealflow360.demo`;
    let [user] = await db.select().from(s.user).where(eq(s.user.email, email));
    if (!user) {
      const result = await createAuth(db, true).api.signUpEmail({
        body: { email, password, name: "Synthetic staff" },
      });
      [user] = await db.select().from(s.user).where(eq(s.user.id, result.user.id));
    }
    await db.insert(s.profiles).values({ userId: user!.id, role }).onConflictDoNothing();
  }
});

afterAll(() => {
  if (previousPassword === undefined) delete Bun.env.DEMO_PASSWORD;
  else Bun.env.DEMO_PASSWORD = previousPassword;
});

test("100 linked scenarios are consistent and concurrent retries cannot duplicate or overwrite them", async () => {
  const results = await Promise.all([seedBulkData(db, options), seedBulkData(db, options)]);
  expect(results.map((result) => result.addedScenarios).sort((a, b) => a - b)).toEqual([0, 100]);
  for (const [table, expected] of [
    [s.customers, 100],
    [s.products, 200],
    [s.quotes, 200],
    [s.orders, 100],
    [s.stocks, 100],
    [s.reservations, 100],
    [s.messages, 200],
    [s.payments, 100],
    [s.credits, 100],
  ] as const) {
    const [row] = await db
      .select({ count: count() })
      .from(table)
      .where(like(table.id, `${prefix}%`));
    expect(row!.count).toBe(expected);
  }
  const quotes = await db
    .select()
    .from(s.quotes)
    .where(like(s.quotes.id, `${prefix}%`));
  expect(quotes.filter((quote) => quote.status === "PENDING_APPROVAL")).toHaveLength(100);
  expect(
    quotes
      .filter((quote) => quote.status === "PENDING_APPROVAL")
      .every((quote) => quote.risk !== "NONE" && quote.approvalStep === "manager"),
  ).toBe(true);
  const invoices = await db
    .select()
    .from(s.invoices)
    .where(like(s.invoices.orderId, `${prefix}%`));
  expect(invoices).toHaveLength(200);
  for (const invoice of invoices) {
    expect(invoice.totalCents).toBeGreaterThan(0);
    expect(invoice.totalCents).toBe(invoice.subtotalCents + invoice.taxCents);
    expect(invoice.totalCents).toBe(invoice.lines.reduce((sum, line) => sum + line.totalCents, 0));
    expect(invoice.paidCents + invoice.creditedCents).toBeLessThanOrEqual(invoice.totalCents);
  }
  const subscriptions = await db
    .select()
    .from(s.subscriptions)
    .where(like(s.subscriptions.orderId, `${prefix}%`));
  expect(subscriptions).toHaveLength(100);
  expect(new Set(subscriptions.map((subscription) => subscription.intervalMonths))).toEqual(
    new Set([1, 3, 12]),
  );
  const stocks = await db
    .select()
    .from(s.stocks)
    .where(like(s.stocks.id, `${prefix}%`));
  for (const stock of stocks) {
    const rows = await db
      .select()
      .from(s.reservations)
      .where(
        and(
          eq(s.reservations.productId, stock.productId),
          eq(s.reservations.warehouseId, stock.warehouseId),
        ),
      );
    expect(stock.reserved).toBe(rows.reduce((sum, row) => sum + row.quantity - row.shipped, 0));
    expect(stock.onHand).toBeGreaterThanOrEqual(stock.reserved);
    const movements = await db
      .select()
      .from(s.stockMovements)
      .where(eq(s.stockMovements.productId, stock.productId));
    expect(stock.onHand).toBe(
      movements.reduce(
        (sum, movement) =>
          sum + (movement.kind === "SHIP" ? -movement.quantity : movement.quantity),
        0,
      ),
    );
  }
  const customerId = `${prefix}0001`;
  const login = await createAuth(db).api.signInEmail({
    body: { email: `${customerId}@example.test`, password },
  });
  const [profile] = await db.select().from(s.profiles).where(eq(s.profiles.userId, login.user.id));
  expect(profile).toMatchObject({ role: "customer", customerId, mustChangePassword: false });
  await db
    .update(s.customers)
    .set({ name: "Edited synthetic customer" })
    .where(eq(s.customers.id, customerId));
  const increased = await seedBulkData(db, { ...options, count: 101 });
  expect(increased).toMatchObject({ addedScenarios: 1, skippedScenarios: 100 });
  const [customer] = await db.select().from(s.customers).where(eq(s.customers.id, customerId));
  expect(customer!.name).toBe("Edited synthetic customer");
}, 60000);

test("a conflict mid-batch rolls back customers, credentials and all linked records", async () => {
  const failedBatch = `fail-${crypto.randomUUID().slice(0, 8)}`;
  const first = `bulk-${failedBatch}-0001`;
  const conflictId = crypto.randomUUID();
  await db.insert(s.customers).values({
    id: conflictId,
    name: "Existing sample",
    email: `bulk-${failedBatch}-0002@example.test`,
  });
  await expect(seedBulkData(db, { ...options, batch: failedBatch, count: 2 })).rejects.toThrow(
    "already belongs",
  );
  expect(await db.select().from(s.customers).where(eq(s.customers.id, first))).toHaveLength(0);
  expect(
    await db
      .select()
      .from(s.user)
      .where(eq(s.user.email, `${first}@example.test`)),
  ).toHaveLength(0);
  expect(
    await db
      .select()
      .from(s.quotes)
      .where(like(s.quotes.id, `bulk-${failedBatch}-%`)),
  ).toHaveLength(0);
  expect(await db.select().from(s.customers).where(eq(s.customers.id, conflictId))).toHaveLength(1);
  expect(
    (
      await seedBulkData(db, {
        ...options,
        batch: `new-${crypto.randomUUID().slice(0, 8)}`,
        count: 1,
      })
    ).addedScenarios,
  ).toBe(1);
}, 10000);
