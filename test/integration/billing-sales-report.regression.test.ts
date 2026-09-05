import { afterAll, beforeAll, expect, test } from "bun:test";

import { and, eq, inArray, sql } from "drizzle-orm";
import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";

import { reportPdf, reportSpreadsheet } from "@/features/billing/documents";
import { financialReport } from "@/features/billing/reports";
import { salesReport } from "@/features/billing/sales-report";
import { approvalAction, confirmQuote, saveQuote, submitQuote } from "@/features/quotes/service";
import { createAuth } from "@/lib/auth/create-auth";
import { db } from "@/lib/db/connection";
import {
  auditEntries,
  customers,
  invoices,
  orders,
  products,
  profiles,
  quoteRevisions,
  quotes,
} from "@/lib/db/schema";
import type { Actor } from "@/lib/domain/_types/domain";
import { api } from "@/server/api";

const id = crypto.randomUUID(),
  customerId = `sales-customer-${id}`,
  otherCustomerId = `sales-other-${id}`,
  targetId = `sales-target-${id}`,
  noiseId = `sales-noise-${id}`,
  team = `sales-team-${id}`;
let rep: Actor, admin: Actor, cookie: string;
const quoteIds: string[] = [];
let confirmedId: string;

beforeAll(async () => {
  if (!new URL(Bun.env.DATABASE_URL!).pathname.endsWith("_test"))
    throw new Error("Sales report tests require _test database");
  await db.insert(customers).values([
    { email: "sales-fixture@example.com", id: customerId, name: "Sales fixture", team },
    {
      email: "other-fixture@example.com",
      id: otherCustomerId,
      name: "Other team",
      team: `other-${id}`,
    },
  ]);
  await db.insert(products).values([
    {
      category: "Services",
      costCents: 0,
      id: targetId,
      name: "Suggested service",
      priceCents: 1000,
    },
    {
      category: "Hardware",
      costCents: 0,
      id: noiseId,
      name: "Unprompted product",
      pairedProductIds: [targetId],
      priceCents: 100,
    },
  ]);
  const actors: Actor[] = [];
  for (const role of ["rep", "rep", "admin"] as const) {
    const suffix = crypto.randomUUID(),
      email = `sales-${suffix}@example.com`,
      password = `Sales-test-${suffix}`;
    const result = await createAuth(db).api.signUpEmail({
      body: { email, name: `Sales ${role}`, password },
    });
    await db.insert(profiles).values({ role, userId: result.user.id });
    actors.push({ customerId: null, email, id: result.user.id, name: `Sales ${role}`, role });
    if (role === "admin") {
      const session = await createAuth(db).api.signInEmail({
        asResponse: true,
        body: { email, password },
      });
      cookie = session.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
    }
  }
  rep = actors[0]!;
  admin = actors[2]!;
  const created = await saveQuote(
    {
      customerId,
      lines: [
        { discountBps: 5000, productId: targetId, quantity: 3, upsell: true },
        { discountBps: 0, productId: noiseId, quantity: 100 },
      ],
      orderDiscountBps: 0,
    },
    rep,
  );
  quoteIds.push(created.id);
  confirmedId = created.id;
  const submitted = await submitQuote(created.id, created.revision, rep);
  expect(submitted.risk).toBe("HIGH");
  await approvalAction(created.id, submitted.revision, "approve", "Manager approval", admin);
  await approvalAction(created.id, submitted.revision, "approve", "Finance approval", admin);
  const order = await confirmQuote(created.id, submitted.revision, admin);
  for (const [owner, customer] of [
    [rep, customerId],
    [actors[1]!, customerId],
    [rep, otherCustomerId],
  ] as const) {
    const draft = await saveQuote(
      {
        customerId: customer,
        lines: [{ discountBps: 0, productId: targetId, quantity: 2 }],
        orderDiscountBps: 0,
      },
      owner,
    );
    quoteIds.push(draft.id);
  }
  await db
    .update(quotes)
    .set({ createdAt: new Date("2099-01-01T08:00:00Z") })
    .where(inArray(quotes.id, quoteIds));
  await db
    .update(orders)
    .set({ createdAt: new Date("2099-01-02T08:00:00Z") })
    .where(eq(orders.id, order.id));
  await db
    .update(invoices)
    .set({ createdAt: new Date("2099-01-03T08:00:00Z") })
    .where(eq(invoices.orderId, order.id));
  await db
    .update(auditEntries)
    .set({ createdAt: new Date("2099-01-01T10:00:00Z") })
    .where(and(eq(auditEntries.entityId, created.id), eq(auditEntries.action, "QUOTE_SUBMITTED")));
  for (const [step, hour] of [
    ["manager", "11"],
    ["finance", "13"],
  ])
    await db
      .update(auditEntries)
      .set({ createdAt: new Date(`2099-01-01T${hour}:00:00Z`) })
      .where(
        and(
          eq(auditEntries.entityId, created.id),
          eq(auditEntries.action, "APPROVAL_APPROVE"),
          sql`${auditEntries.detail}->>'step' = ${step}`,
        ),
      );
});

afterAll(async () => {
  await db.transaction(async (tx) => {
    const createdOrders = await tx
      .select({ id: orders.id })
      .from(orders)
      .where(inArray(orders.quoteId, quoteIds));
    await tx
      .delete(auditEntries)
      .where(
        inArray(auditEntries.entityId, [...quoteIds, ...createdOrders.map((order) => order.id)]),
      );
    await tx.delete(invoices).where(inArray(invoices.customerId, [customerId, otherCustomerId]));
    await tx.delete(orders).where(inArray(orders.quoteId, quoteIds));
    await tx.delete(quoteRevisions).where(inArray(quoteRevisions.quoteId, quoteIds));
    await tx.delete(quotes).where(inArray(quotes.id, quoteIds));
    await tx.delete(customers).where(inArray(customers.id, [customerId, otherCustomerId]));
    await tx.delete(products).where(inArray(products.id, [targetId, noiseId]));
  });
});

test("rep/team/product filters include draft quotes without invoices and count confirmed upsell units", async () => {
  const filters = { repId: rep.id, team, productId: targetId, category: "Services" };
  const sales = await salesReport(filters),
    financial = await financialReport(filters);
  expect(sales.metrics).toEqual({
    averageApprovalHours: 3,
    completedApprovalCycles: 1,
    orderedCents: 11500,
    ordersConfirmed: 1,
    quotesCreated: 2,
    topUpsoldProduct: { name: "Suggested service", productId: targetId, quantity: 3 },
  });
  expect(financial.rows).toHaveLength(1);
  expect(financial.totals.billedCents).toBe(11500);
  const workbook = new ExcelJS.Workbook();
  const spreadsheet = await reportSpreadsheet(financial.rows, "Filtered sales", sales);
  await workbook.xlsx.load(spreadsheet.buffer as ArrayBuffer);
  expect(workbook.getWorksheet("Sales metrics")?.getCell("B8").value).toBe(3);
  expect(workbook.getWorksheet("Sales metrics")?.getCell("B7").value).toBe("Suggested service");
  expect(workbook.getWorksheet("Orders")?.rowCount).toBe(2);

  expect(
    (await salesReport({ ...filters, approvalStatus: "NOT_SUBMITTED" })).metrics.quotesCreated,
  ).toBe(1);
  expect(
    (await financialReport({ ...filters, approvalStatus: "NOT_SUBMITTED" })).rows,
  ).toHaveLength(0);
  expect(
    (await salesReport({ ...filters, approvalStatus: "APPROVED" })).quotes.map((quote) => quote.id),
  ).toEqual([confirmedId]);
  expect((await financialReport({ ...filters, approvalStatus: "APPROVED" })).rows).toHaveLength(1);
  expect((await salesReport({ ...filters, category: "Hardware" })).metrics.quotesCreated).toBe(0);
});

test("date filters use each record's own creation or issue date and exports match filtered records", async () => {
  const filters = {
    repId: rep.id,
    team,
    productId: targetId,
    from: "2099-01-01",
    to: "2099-01-01",
  };
  const sales = await salesReport(filters),
    financial = await financialReport(filters);
  expect(sales.metrics.quotesCreated).toBe(2);
  expect(sales.orders).toHaveLength(0);
  expect(financial.rows).toHaveLength(0);
  const bytes = await reportSpreadsheet(financial.rows, "January 1 cohort", sales);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes.buffer as ArrayBuffer);
  expect(workbook.getWorksheet("Quotations")?.rowCount).toBe(3);
  expect(workbook.getWorksheet("Orders")?.rowCount).toBe(1);
  expect(workbook.getWorksheet("Sales metrics")?.getCell("B2").value).toBe(2);
  expect(workbook.getWorksheet("Financial report")?.rowCount).toBe(1);
  const pdf = await PDFDocument.load(await reportPdf(financial.rows, "January 1 cohort", sales));
  expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
  const query = new URLSearchParams(filters);
  const response = await api.handle(
    new Request(`${Bun.env.BETTER_AUTH_URL}/api/v1/reports/financial?${query}`, {
      headers: { cookie },
    }),
  );
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.sales.metrics.quotesCreated).toBe(2);
  expect(result.rows).toHaveLength(0);
  expect(result.options.representatives.some((entry: { id: string }) => entry.id === rep.id)).toBe(
    true,
  );
});
