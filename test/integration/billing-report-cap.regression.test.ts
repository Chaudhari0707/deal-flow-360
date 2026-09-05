import { afterAll, beforeAll, expect, test } from "bun:test";

import { eq, inArray } from "drizzle-orm";

import { financialReport } from "@/features/billing/reports";
import { createAuth } from "@/lib/auth/create-auth";
import { db } from "@/lib/db/connection";
import { credits, customers, invoices, orders, products, quotes } from "@/lib/db/schema";
import type { QuoteLine } from "@/lib/domain/_types/domain";

const fixtureId = crypto.randomUUID();
const customerId = `report-cap-${fixtureId}`;
const noiseProduct = `noise-${fixtureId}`,
  targetProduct = `target-${fixtureId}`;
const issuedAt = new Date("2099-01-01T12:00:00Z");
const invoiceIds = Array.from(
  { length: 2002 },
  (_, index) => `report-invoice-${fixtureId}-${index}`,
);

beforeAll(async () => {
  if (!new URL(Bun.env.DATABASE_URL!).pathname.endsWith("_test"))
    throw new Error("Report cap tests require _test database");
  const account = await createAuth(db).api.signUpEmail({
    body: {
      email: `report-cap-${fixtureId}@example.com`,
      name: "Report cap fixture",
      password: `Report-test-${fixtureId}`,
    },
  });
  const lines: QuoteLine[][] = invoiceIds.map((_, index) => [
    {
      category: index === 2001 ? "Needle" : "Other",
      costCents: 0,
      discountBps: 0,
      id: `line-${index}`,
      intervalMonths: 0,
      name: "Report fixture service",
      netCents: 100,
      priceCents: 100,
      productId: index === 2001 ? targetProduct : noiseProduct,
      quantity: 1,
      stockable: false,
      taxBps: 0,
      taxCents: 0,
      totalCents: 100,
      variant: "Standard",
    },
  ]);
  await db.transaction(async (tx) => {
    await tx
      .insert(customers)
      .values({ email: "report-fixture@example.com", id: customerId, name: "Report cap fixture" });
    await tx.insert(products).values([
      { category: "Other", costCents: 0, id: noiseProduct, name: "Noise service", priceCents: 100 },
      {
        category: "Needle",
        costCents: 0,
        id: targetProduct,
        name: "Target service",
        priceCents: 100,
      },
    ]);
    await tx.insert(quotes).values(
      invoiceIds.map((id, index) => ({
        approvedRevision: 1,
        createdAt: issuedAt,
        customerId,
        id: `q-${id}`,
        lines: lines[index]!,
        number: `Q-${id}`,
        ownerId: account.user.id,
        status: "CONFIRMED" as const,
        subtotalCents: 100,
        totalCents: 100,
      })),
    );
    await tx.insert(orders).values(
      invoiceIds.map((id, index) => ({
        createdAt: issuedAt,
        customerId,
        id: `o-${id}`,
        lines: lines[index]!,
        number: `SO-${id}`,
        quoteId: `q-${id}`,
      })),
    );
    await tx.insert(invoices).values(
      invoiceIds.map((id, index) => ({
        createdAt: issuedAt,
        creditedCents: index === 2001 ? 0 : 10,
        customerId,
        dueDate: "2099-01-15",
        id,
        kind: "ONE_TIME",
        lines: lines[index]!,
        number: id,
        operationKey: id,
        orderId: `o-${id}`,
        paidCents: index === 2001 ? 100 : 0,
        status: index === 2001 ? "PAID" : "UNPAID",
        subtotalCents: 100,
        taxCents: 0,
        totalCents: 100,
      })),
    );
    await tx.insert(credits).values(
      invoiceIds.map((id, index) => ({
        amountCents: 10,
        appliedCents: index === 2001 ? 0 : 10,
        createdAt: issuedAt,
        customerId,
        id: `credit-${id}`,
        invoiceId: id,
        number: `CN-${id}`,
        operationKey: `credit-${id}`,
        reason: "Report cap fixture credit",
      })),
    );
  });
});

afterAll(async () => {
  // Exact synthetic fixture IDs only; preserve every unrelated concurrent workstream record.
  await db.transaction(async (tx) => {
    await tx.delete(credits).where(eq(credits.customerId, customerId));
    await tx.delete(invoices).where(eq(invoices.customerId, customerId));
    await tx.delete(orders).where(eq(orders.customerId, customerId));
    await tx.delete(quotes).where(eq(quotes.customerId, customerId));
    await tx.delete(customers).where(eq(customers.id, customerId));
    await tx.delete(products).where(inArray(products.id, [noiseProduct, targetProduct]));
  });
});

test("category and status filters apply before invoice and credit report caps", async () => {
  const filter = { category: "Needle", customerId, from: "2099-01-01", to: "2099-01-01" };
  const selected = await financialReport(filter);
  expect(selected.rows.map((row) => row.number).sort()).toEqual(
    [`CN-${invoiceIds[2001]}`, invoiceIds[2001]!].sort(),
  );
  expect(selected.totals).toEqual({ billedCents: 90, outstandingCents: 0, paidCents: 100 });
  expect((await financialReport({ customerId, status: "PAID" })).rows).toHaveLength(1);
  const paid = await financialReport({ ...filter, status: "PAID" });
  expect(paid.rows).toHaveLength(1);
  expect(paid.rows[0]?.number).toBe(invoiceIds[2001]);
  expect(
    (await financialReport({ ...filter, to: "2098-12-31", from: "2098-01-01" })).rows,
  ).toHaveLength(0);
  await expect(financialReport({ customerId })).rejects.toThrow("2,000 invoices");
});
