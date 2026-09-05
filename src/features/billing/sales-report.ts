import { and, asc, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";

import type { ReportFilters, SalesRecord, SalesReport } from "@/features/billing/_types/reports";
import { approvalCycleMetrics } from "@/features/billing/approval-metrics";
import {
  reportLineConditions,
  reportRelationshipConditions,
} from "@/features/billing/report-filters";
import { db } from "@/lib/db/connection";
import { user } from "@/lib/db/schema/auth";
import { auditEntries, customers, orders, quotes } from "@/lib/db/schema/commerce";
import { DomainError } from "@/server/errors";

export async function salesReport(filters: ReportFilters): Promise<SalesReport> {
  if (filters.from && filters.to && filters.from > filters.to)
    throw new DomainError("Report start must be before its end");
  const common = [
    ...reportRelationshipConditions(filters),
    ...(filters.customerId ? [eq(customers.id, filters.customerId)] : []),
  ];
  const [selectedQuotes, selectedOrders] = await Promise.all([
    db
      .select({
        customer: customers.name,
        quote: quotes,
        representative: user.name,
        team: customers.team,
      })
      .from(quotes)
      .innerJoin(customers, eq(customers.id, quotes.customerId))
      .innerJoin(user, eq(user.id, quotes.ownerId))
      .where(
        and(
          ...common,
          ...reportLineConditions(quotes.lines, filters),
          ...(filters.from ? [gte(quotes.createdAt, new Date(`${filters.from}T00:00:00Z`))] : []),
          ...(filters.to ? [lte(quotes.createdAt, new Date(`${filters.to}T23:59:59.999Z`))] : []),
        ),
      )
      .orderBy(asc(quotes.createdAt), asc(quotes.id))
      .limit(2001),
    db
      .select({
        customer: customers.name,
        order: orders,
        representative: user.name,
        team: customers.team,
      })
      .from(orders)
      .innerJoin(quotes, eq(quotes.id, orders.quoteId))
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .innerJoin(user, eq(user.id, quotes.ownerId))
      .where(
        and(
          ...common,
          ...reportLineConditions(orders.lines, filters),
          ...(filters.from ? [gte(orders.createdAt, new Date(`${filters.from}T00:00:00Z`))] : []),
          ...(filters.to ? [lte(orders.createdAt, new Date(`${filters.to}T23:59:59.999Z`))] : []),
        ),
      )
      .orderBy(asc(orders.createdAt), asc(orders.id))
      .limit(2001),
  ]);
  if (selectedQuotes.length > 2000 || selectedOrders.length > 2000)
    throw new DomainError("Narrow the report filters to at most 2,000 quotes and 2,000 orders");
  const history = selectedQuotes.length
    ? await db
        .select()
        .from(auditEntries)
        .where(
          and(
            inArray(
              auditEntries.entityId,
              selectedQuotes.map((entry) => entry.quote.id),
            ),
            isNotNull(auditEntries.revision),
            inArray(auditEntries.action, [
              "QUOTE_SUBMITTED",
              "AUTO_APPROVED",
              "CUSTOMER_COUNTERED",
              "APPROVAL_APPROVE",
              "APPROVAL_RETURN",
              "APPROVAL_REJECT",
            ]),
          ),
        )
        .orderBy(asc(auditEntries.createdAt), asc(auditEntries.id))
        .limit(20001)
    : [];
  if (history.length > 20000)
    throw new DomainError("Narrow the report filters to at most 20,000 approval events");
  const quoteRows: SalesRecord[] = selectedQuotes.map(
    ({ customer, quote, representative, team }) => ({
      amountCents: quote.totalCents,
      customer,
      date: quote.createdAt.toISOString(),
      id: quote.id,
      kind: "QUOTE",
      number: quote.number,
      representative,
      status: quote.status,
      team,
    }),
  );
  const orderRows: SalesRecord[] = selectedOrders.map(
    ({ customer, order, representative, team }) => ({
      amountCents: order.lines.reduce((sum, line) => sum + line.totalCents, 0),
      customer,
      date: order.createdAt.toISOString(),
      id: order.id,
      kind: "ORDER",
      number: order.number,
      representative,
      status: order.fulfillmentStatus,
      team,
    }),
  );
  const upsells = new Map<string, { name: string; productId: string; quantity: number }>();
  for (const { order } of selectedOrders)
    for (const line of order.lines) {
      if (
        !line.upsell ||
        (filters.productId && line.productId !== filters.productId) ||
        (filters.category && line.category !== filters.category)
      )
        continue;
      const previous = upsells.get(line.productId);
      upsells.set(line.productId, {
        name: line.name,
        productId: line.productId,
        quantity: (previous?.quantity ?? 0) + line.quantity,
      });
    }
  const topUpsoldProduct =
    [...upsells.values()].sort(
      (a, b) => b.quantity - a.quantity || a.productId.localeCompare(b.productId),
    )[0] ?? null;
  return {
    metrics: {
      ...approvalCycleMetrics(history),
      orderedCents: orderRows.reduce((sum, row) => sum + row.amountCents, 0),
      ordersConfirmed: orderRows.length,
      quotesCreated: quoteRows.length,
      topUpsoldProduct,
    },
    orders: orderRows,
    quotes: quoteRows,
  };
}

export async function reportOptions() {
  const [representatives, teams] = await Promise.all([
    db
      .selectDistinct({ id: user.id, name: user.name })
      .from(user)
      .innerJoin(quotes, eq(quotes.ownerId, user.id))
      .orderBy(asc(user.name), asc(user.id))
      .limit(200),
    db
      .selectDistinct({ team: customers.team })
      .from(customers)
      .orderBy(asc(customers.team))
      .limit(200),
  ]);
  return { representatives, teams: teams.map((row) => row.team) };
}
