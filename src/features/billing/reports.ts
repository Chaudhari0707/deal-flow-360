import { and, asc, eq, gte, lte } from "drizzle-orm";

import type { ReportRow } from "@/features/billing/_types/documents";
import type { ReportFilters } from "@/features/billing/_types/reports";
import {
  reportLineConditions,
  reportRelationshipConditions,
} from "@/features/billing/report-filters";
import { invoiceOutstanding } from "@/features/billing/rules";
import { db } from "@/lib/db/connection";
import { credits, invoices } from "@/lib/db/schema/billing";
import { customers, orders, quotes } from "@/lib/db/schema/commerce";
import { DomainError } from "@/server/errors";

export async function financialReport(filters: ReportFilters) {
  if (filters.from && filters.to && filters.from > filters.to)
    throw new DomainError("Report start must be before its end");
  const conditions = [
    ...reportRelationshipConditions(filters),
    ...reportLineConditions(invoices.lines, filters),
    ...(filters.customerId ? [eq(invoices.customerId, filters.customerId)] : []),
    ...(filters.status ? [eq(invoices.status, filters.status)] : []),
    ...(filters.from ? [gte(invoices.createdAt, new Date(`${filters.from}T00:00:00Z`))] : []),
    ...(filters.to ? [lte(invoices.createdAt, new Date(`${filters.to}T23:59:59.999Z`))] : []),
  ];
  const source = await db
    .select({ customer: customers.name, invoice: invoices })
    .from(invoices)
    .innerJoin(customers, eq(customers.id, invoices.customerId))
    .innerJoin(orders, eq(orders.id, invoices.orderId))
    .innerJoin(quotes, eq(quotes.id, orders.quoteId))
    .where(and(...conditions))
    .orderBy(asc(invoices.createdAt), asc(invoices.id))
    .limit(2001);
  if (source.length > 2000)
    throw new DomainError("Narrow the report filters to at most 2,000 invoices", 400);
  const rows: ReportRow[] = source.map(({ customer, invoice }) => ({
    category: [...new Set(invoice.lines.map((line) => line.category))].join(", "),
    customer,
    date: invoice.createdAt.toISOString(),
    kind: invoice.kind,
    number: invoice.number,
    outstandingCents: invoiceOutstanding(invoice),
    paidCents: invoice.paidCents,
    status: invoice.status,
    totalCents: invoice.totalCents,
  }));
  const creditRows = filters.status
    ? []
    : await db
        .select({ credit: credits, customer: customers.name })
        .from(credits)
        .innerJoin(customers, eq(customers.id, credits.customerId))
        .innerJoin(invoices, eq(invoices.id, credits.invoiceId))
        .innerJoin(orders, eq(orders.id, invoices.orderId))
        .innerJoin(quotes, eq(quotes.id, orders.quoteId))
        .where(
          and(
            ...reportRelationshipConditions(filters),
            ...reportLineConditions(invoices.lines, filters),
            ...(filters.customerId ? [eq(credits.customerId, filters.customerId)] : []),
            ...(filters.from
              ? [gte(credits.createdAt, new Date(`${filters.from}T00:00:00Z`))]
              : []),
            ...(filters.to
              ? [lte(credits.createdAt, new Date(`${filters.to}T23:59:59.999Z`))]
              : []),
          ),
        )
        .orderBy(asc(credits.createdAt), asc(credits.id))
        .limit(2001);
  if (creditRows.length > 2000)
    throw new DomainError("Narrow the report filters to at most 2,000 credits", 400);
  for (const { credit, customer } of creditRows) {
    rows.push({
      category: "Credit",
      customer,
      date: credit.createdAt.toISOString(),
      kind: "credit",
      number: credit.number,
      outstandingCents: 0,
      paidCents: 0,
      status: credit.appliedCents === credit.amountCents ? "APPLIED" : "AVAILABLE",
      totalCents: credit.amountCents,
    });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number));
  return {
    rows,
    totals: {
      billedCents: rows.reduce(
        (sum, row) => sum + (row.kind === "credit" ? -row.totalCents : row.totalCents),
        0,
      ),
      outstandingCents: rows.reduce((sum, row) => sum + row.outstandingCents, 0),
      paidCents: rows.reduce((sum, row) => sum + row.paidCents, 0),
    },
  };
}
