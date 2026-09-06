import "server-only";

import { and, desc, eq } from "drizzle-orm";
import type Stripe from "stripe";

import { invoiceOutstanding } from "@/features/billing/rules";
import { recordPayment } from "@/features/billing/service";
import { appOrigin, stripeClient, stripePublishableKey } from "@/features/billing/stripe-client";
import { stripePaymentKeys } from "@/features/billing/stripe-keys";
import { db } from "@/lib/db/connection";
import { profiles, user } from "@/lib/db/schema";
import { invoices } from "@/lib/db/schema/billing";
import type { Actor } from "@/lib/domain/_types/domain";
import { DomainError } from "@/server/errors";

export async function listCustomerInvoices(actor: Actor) {
  if (actor.role !== "customer" || !actor.customerId)
    throw new DomainError("Only customer accounts can list portal invoices", 403);
  const rows = await db
    .select()
    .from(invoices)
    .where(eq(invoices.customerId, actor.customerId))
    .orderBy(desc(invoices.createdAt), desc(invoices.id))
    .limit(100);
  return rows.map((invoice) => ({
    createdAt: invoice.createdAt.toISOString(),
    dueDate: invoice.dueDate,
    id: invoice.id,
    kind: invoice.kind,
    number: invoice.number,
    outstandingCents: invoiceOutstanding(invoice),
    paidCents: invoice.paidCents,
    status: invoice.status,
    totalCents: invoice.totalCents,
  }));
}

export async function createInvoiceCheckoutSession(actor: Actor, invoiceId: string) {
  if (actor.role !== "customer" || !actor.customerId || !actor.id)
    throw new DomainError("Sign in with your customer account to pay an invoice", 403);
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
  if (!invoice || invoice.customerId !== actor.customerId)
    throw new DomainError("Invoice not found", 404);
  const amountCents = invoiceOutstanding(invoice);
  if (amountCents <= 0) throw new DomainError("Invoice has no outstanding balance", 409);
  if (amountCents < 50)
    throw new DomainError("Outstanding balance is below the Stripe INR minimum (₹0.50)", 409);

  const origin = appOrigin();
  const session = await stripeClient().checkout.sessions.create({
    ui_mode: "embedded_page",
    mode: "payment",
    customer_email: actor.email || undefined,
    client_reference_id: invoice.id,
    metadata: {
      actorId: actor.id,
      customerId: actor.customerId,
      invoiceId: invoice.id,
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "inr",
          unit_amount: amountCents,
          product_data: {
            name: `Invoice ${invoice.number}`,
            description: `${invoice.kind} · due ${invoice.dueDate}`,
          },
        },
      },
    ],
    return_url: `${origin}/portal/billing/return?session_id={CHECKOUT_SESSION_ID}`,
  });
  if (!session.client_secret)
    throw new DomainError("Stripe did not return a Checkout client secret", 502);
  return {
    clientSecret: session.client_secret,
    publishableKey: stripePublishableKey(),
    sessionId: session.id,
  };
}

async function actorFromMetadata(actorId: string, customerId: string): Promise<Actor> {
  const [row] = await db
    .select({
      customerId: profiles.customerId,
      email: user.email,
      id: user.id,
      mustChangePassword: profiles.mustChangePassword,
      name: user.name,
      role: profiles.role,
    })
    .from(profiles)
    .innerJoin(user, eq(user.id, profiles.userId))
    .where(and(eq(profiles.userId, actorId), eq(profiles.role, "customer")));
  if (!row || row.customerId !== customerId)
    throw new DomainError("Checkout session customer actor is invalid", 400);
  return {
    customerId: row.customerId,
    email: row.email,
    id: row.id,
    mustChangePassword: row.mustChangePassword,
    name: row.name,
    role: "customer",
  };
}

export async function fulfillCheckoutSession(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") return { ignored: true as const, reason: "not_paid" };
  const invoiceId = session.metadata?.invoiceId?.trim();
  const actorId = session.metadata?.actorId?.trim();
  const customerId = session.metadata?.customerId?.trim();
  if (!invoiceId || !actorId || !customerId)
    throw new DomainError("Checkout session is missing invoice metadata", 400);
  const { operationKey, reference } = stripePaymentKeys(session.id);
  const actor = await actorFromMetadata(actorId, customerId);
  try {
    const result = await recordPayment(actor, invoiceId, operationKey, reference);
    return { ignored: false as const, invoiceId, paymentId: result.payment.id };
  } catch (error) {
    if (error instanceof DomainError && error.status === 409) {
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
      if (invoice && invoiceOutstanding(invoice) === 0)
        return { ignored: true as const, reason: "already_settled" as const, invoiceId };
    }
    throw error;
  }
}
