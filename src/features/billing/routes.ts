import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { invoicePdf, reportPdf, reportSpreadsheet } from "@/features/billing/documents";
import { financialReport } from "@/features/billing/reports";
import { reportOptions, salesReport } from "@/features/billing/sales-report";
import { changeSubscription, recordPayment, runDueBilling } from "@/features/billing/service";
import { db } from "@/lib/db/connection";
import { invoices } from "@/lib/db/schema/billing";
import { customers, orders, quotes } from "@/lib/db/schema/commerce";
import { requireActor } from "@/server/access";
import { DomainError } from "@/server/errors";

const id = t.Object({ id: t.String({ minLength: 1, maxLength: 100 }) });
const key = t.String({ minLength: 8, maxLength: 100 });
const reason = t.String({ minLength: 3, maxLength: 500 });
const reportQuery = t.Object({
  approvalStatus: t.Optional(
    t.Union([
      t.Literal("APPROVED"),
      t.Literal("PENDING"),
      t.Literal("NOT_SUBMITTED"),
      t.Literal("RETURNED"),
      t.Literal("REJECTED"),
    ]),
  ),
  productId: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  repId: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  team: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  category: t.Optional(t.String({ maxLength: 100 })),
  customerId: t.Optional(t.String({ maxLength: 100 })),
  format: t.Optional(t.Union([t.Literal("pdf"), t.Literal("xlsx")])),
  from: t.Optional(t.String({ format: "date" })),
  status: t.Optional(t.Union([t.Literal("PAID"), t.Literal("UNPAID")])),
  to: t.Optional(t.String({ format: "date" })),
});

function download(bytes: Uint8Array, name: string, type: string) {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Content-Type": type,
    },
  });
}

export const billingRoutes = new Elysia({ name: "billing" })
  .post(
    "/invoices/:id/pay",
    async ({ request, params, body }) =>
      recordPayment(
        await requireActor(request, ["admin", "finance"]),
        params.id,
        body.operationKey,
        body.reference,
      ),
    {
      body: t.Object({ operationKey: key, reference: t.String({ minLength: 3, maxLength: 100 }) }),
      params: id,
    },
  )
  .post("/subscriptions/run-due", async ({ request }) =>
    runDueBilling(await requireActor(request, ["admin", "finance"])),
  )
  .post(
    "/subscriptions/:id/change",
    async ({ request, params, body }) =>
      changeSubscription(await requireActor(request, ["admin", "finance"]), params.id, body),
    {
      body: t.Object({
        operationKey: key,
        productId: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        quantity: t.Number({ minimum: 1, maximum: 10000, multipleOf: 1 }),
        reason,
        version: t.Number({ minimum: 1, multipleOf: 1 }),
      }),
      params: id,
    },
  )
  .post(
    "/subscriptions/:id/cancel",
    async ({ request, params, body }) =>
      changeSubscription(await requireActor(request, ["admin", "finance"]), params.id, body, true),
    {
      body: t.Object({
        operationKey: key,
        reason,
        version: t.Number({ minimum: 1, multipleOf: 1 }),
      }),
      params: id,
    },
  )
  .get(
    "/invoices/:id/pdf",
    async ({ request, params }) => {
      const actor = await requireActor(request);
      const [record] = await db
        .select({ customer: customers, invoice: invoices, quote: quotes })
        .from(invoices)
        .innerJoin(customers, eq(invoices.customerId, customers.id))
        .innerJoin(orders, eq(invoices.orderId, orders.id))
        .innerJoin(quotes, eq(orders.quoteId, quotes.id))
        .where(eq(invoices.id, params.id));
      if (!record) throw new DomainError("Invoice not found", 404);
      const { invoice, customer, quote } = record;
      if (
        (actor.role === "customer" && actor.customerId !== customer.id) ||
        (actor.role === "rep" && quote.ownerId !== actor.id) ||
        actor.role === "ops"
      )
        throw new DomainError("You cannot access this invoice", 403);
      const bytes = await invoicePdf({
        creditedCents: invoice.creditedCents,
        customer: customer.name,
        dueAt: invoice.dueDate,
        issuedAt: invoice.createdAt.toISOString(),
        kind: invoice.kind,
        lines: invoice.lines.map((line) => ({
          description: `${line.name} (${line.variant})`,
          quantity: line.quantity,
          totalCents: line.totalCents,
          unitPriceCents: line.priceCents,
        })),
        number: invoice.number,
        paidCents: invoice.paidCents,
        status: invoice.status,
        totalCents: invoice.totalCents,
      });
      return download(bytes, `${invoice.number}.pdf`, "application/pdf");
    },
    { params: id },
  )
  .get(
    "/reports/financial",
    async ({ request, query }) => {
      await requireActor(request, ["admin", "finance", "manager"]);
      const [financial, sales, options] = await Promise.all([
        financialReport(query),
        salesReport(query),
        reportOptions(),
      ]);
      const result = { ...financial, sales, options };
      const description = `Date range ${query.from ?? "all"} to ${query.to ?? "all"}; customer ${query.customerId ?? "all"}; category ${query.category ?? "all"}; status ${query.status ?? "all"}. Sales dates use quote/order creation; financial dates use issue. Rep ${query.repId ?? "all"}; team ${query.team ?? "all"}; approval ${query.approvalStatus ?? "all"}; product ${query.productId ?? "all"}. Category/product select whole records with a matching line; payment status only affects financial rows.`;
      if (query.format === "pdf")
        return download(
          await reportPdf(result.rows, description, result.sales),
          "dealflow-report.pdf",
          "application/pdf",
        );
      if (query.format === "xlsx")
        return download(
          await reportSpreadsheet(result.rows, description, result.sales),
          "dealflow-report.xlsx",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
      return result;
    },
    { query: reportQuery },
  );
