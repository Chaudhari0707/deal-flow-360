import { desc, eq, inArray, not, or } from "drizzle-orm";

import { db } from "@/lib/db/connection";
import * as s from "@/lib/db/schema";
import type { Actor } from "@/lib/domain/_types/domain";
import { can } from "@/lib/domain/permissions";

export async function workspaceSnapshot(actor: Actor) {
  const representative = actor.role === "rep";
  const financial = can(actor.role, "billingRead");
  const stockVisible = can(actor.role, "stockRead");
  // Scope in SQL before bounding a dataset so unrelated records cannot crowd out owned rows.
  const ownedQuotes = db
    .select({ id: s.quotes.id })
    .from(s.quotes)
    .where(eq(s.quotes.ownerId, actor.id));
  const ownedOrders = db
    .select({ id: s.orders.id })
    .from(s.orders)
    .where(inArray(s.orders.quoteId, ownedQuotes));
  const ownedSubscriptions = db
    .select({ id: s.subscriptions.id })
    .from(s.subscriptions)
    .where(inArray(s.subscriptions.orderId, ownedOrders));
  const ownedInvoices = db
    .select({ id: s.invoices.id })
    .from(s.invoices)
    .where(inArray(s.invoices.orderId, ownedOrders));
  const ownedCredits = db
    .select({ id: s.credits.id })
    .from(s.credits)
    .where(inArray(s.credits.invoiceId, ownedInvoices));
  const ownedPayments = db
    .select({ id: s.payments.id })
    .from(s.payments)
    .where(inArray(s.payments.invoiceId, ownedInvoices));
  const representativeActivity = or(
    inArray(s.auditEntries.entityId, ownedQuotes),
    inArray(s.auditEntries.entityId, ownedOrders),
    inArray(s.auditEntries.entityId, ownedSubscriptions),
    inArray(s.auditEntries.entityId, ownedInvoices),
    inArray(s.auditEntries.entityId, ownedCredits),
    inArray(s.auditEntries.entityId, ownedPayments),
  );
  const financialActivity = or(
    inArray(s.auditEntries.entityId, db.select({ id: s.invoices.id }).from(s.invoices)),
    inArray(s.auditEntries.entityId, db.select({ id: s.subscriptions.id }).from(s.subscriptions)),
    inArray(s.auditEntries.entityId, db.select({ id: s.credits.id }).from(s.credits)),
    inArray(s.auditEntries.entityId, db.select({ id: s.payments.id }).from(s.payments)),
  );
  const [
    customers,
    products,
    quotes,
    warehouses,
    stocks,
    orders,
    subscriptions,
    invoices,
    credits,
    payments,
    reservations,
    messages,
    settings,
    activity,
    deliveries,
  ] = await Promise.all([
    db.select().from(s.customers).orderBy(s.customers.id).limit(200),
    db.select().from(s.products).orderBy(s.products.id).limit(200),
    db
      .select()
      .from(s.quotes)
      .where(representative ? eq(s.quotes.ownerId, actor.id) : undefined)
      .orderBy(desc(s.quotes.createdAt), desc(s.quotes.id))
      .limit(200),
    stockVisible ? db.select().from(s.warehouses).orderBy(s.warehouses.id).limit(100) : [],
    stockVisible ? db.select().from(s.stocks).orderBy(s.stocks.id).limit(1000) : [],
    db
      .select()
      .from(s.orders)
      .where(representative ? inArray(s.orders.quoteId, ownedQuotes) : undefined)
      .orderBy(desc(s.orders.createdAt), desc(s.orders.id))
      .limit(200),
    financial
      ? db
          .select()
          .from(s.subscriptions)
          .where(representative ? inArray(s.subscriptions.orderId, ownedOrders) : undefined)
          .orderBy(desc(s.subscriptions.createdAt), desc(s.subscriptions.id))
          .limit(200)
      : [],
    financial
      ? db
          .select()
          .from(s.invoices)
          .where(representative ? inArray(s.invoices.orderId, ownedOrders) : undefined)
          .orderBy(desc(s.invoices.createdAt), desc(s.invoices.id))
          .limit(200)
      : [],
    financial
      ? db
          .select()
          .from(s.credits)
          .where(representative ? inArray(s.credits.invoiceId, ownedInvoices) : undefined)
          .orderBy(desc(s.credits.createdAt), desc(s.credits.id))
          .limit(200)
      : [],
    financial
      ? db
          .select()
          .from(s.payments)
          .where(representative ? inArray(s.payments.invoiceId, ownedInvoices) : undefined)
          .orderBy(desc(s.payments.createdAt), desc(s.payments.id))
          .limit(200)
      : [],
    stockVisible
      ? db
          .select()
          .from(s.reservations)
          .where(representative ? inArray(s.reservations.orderId, ownedOrders) : undefined)
          .orderBy(s.reservations.id)
          .limit(1000)
      : [],
    db
      .select()
      .from(s.messages)
      .where(representative ? inArray(s.messages.quoteId, ownedQuotes) : undefined)
      .orderBy(desc(s.messages.createdAt), desc(s.messages.id))
      .limit(200),
    db.select().from(s.settings).orderBy(s.settings.id),
    db
      .select()
      .from(s.auditEntries)
      .where(
        representative ? representativeActivity : financial ? undefined : not(financialActivity!),
      )
      .orderBy(desc(s.auditEntries.createdAt), desc(s.auditEntries.id))
      .limit(100),
    db
      .select({
        id: s.deliveries.id,
        quoteId: s.deliveries.quoteId,
        revision: s.deliveries.revision,
        status: s.deliveries.status,
        providerId: s.deliveries.providerId,
        error: s.deliveries.error,
        attempts: s.deliveries.attempts,
        createdAt: s.deliveries.createdAt,
      })
      .from(s.deliveries)
      .where(representative ? inArray(s.deliveries.quoteId, ownedQuotes) : undefined)
      .orderBy(desc(s.deliveries.createdAt), desc(s.deliveries.id))
      .limit(200),
  ]);
  return {
    actor,
    asOf: new Date().toISOString(),
    customers,
    products,
    quotes,
    warehouses,
    stocks,
    orders,
    subscriptions,
    invoices,
    credits,
    payments,
    reservations,
    messages,
    settings,
    activity,
    deliveries,
  };
}
