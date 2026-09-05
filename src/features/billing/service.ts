import { and, asc, eq, lte, sql } from "drizzle-orm";

import { dateKey, issueInvoice, subscriptionLine } from "@/features/billing/creation";
import { catchUpSubscription } from "@/features/billing/cycles";
import {
  invoiceOutstanding,
  periodCharge,
  proratedAdjustment,
  roundRatioHalfUp,
} from "@/features/billing/rules";
import type { DbTransaction } from "@/lib/db/_types/database";
import { db } from "@/lib/db/connection";
import { credits, invoices, payments, subscriptions } from "@/lib/db/schema/billing";
import { auditEntries, products } from "@/lib/db/schema/commerce";
import type { Actor } from "@/lib/domain/_types/domain";
import { audit } from "@/server/audit";
import { DomainError } from "@/server/errors";

export async function recordPayment(
  actor: Actor,
  invoiceId: string,
  operationKey: string,
  reference: string,
) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${operationKey}, 0))`);
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .for("update");
    if (!invoice) throw new DomainError("Invoice not found", 404);
    const [existing] = await tx
      .select()
      .from(payments)
      .where(eq(payments.operationKey, operationKey));
    if (existing) {
      if (
        existing.invoiceId !== invoiceId ||
        existing.reference !== reference ||
        existing.actorId !== actor.id
      )
        throw new DomainError("Payment key was already used for another operation", 409);
      return { invoice, payment: existing };
    }
    const amountCents = invoiceOutstanding(invoice);
    if (amountCents === 0) throw new DomainError("Invoice has no outstanding balance", 409);
    const [payment] = await tx
      .insert(payments)
      .values({
        actorId: actor.id,
        amountCents,
        id: crypto.randomUUID(),
        invoiceId,
        operationKey,
        reference,
      })
      .returning();
    const [updated] = await tx
      .update(invoices)
      .set({ paidCents: invoice.paidCents + amountCents, status: "PAID" })
      .where(eq(invoices.id, invoiceId))
      .returning();
    await audit(tx, actor, invoiceId, "PAYMENT_RECORDED", reference, { amountCents, operationKey });
    return { invoice: updated, payment };
  });
}

async function issueCredits(
  tx: DbTransaction,
  subscription: typeof subscriptions.$inferSelect,
  amountCents: number,
  key: string,
  reason: string,
) {
  const sources = await tx
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.subscriptionId, subscription.id),
        eq(invoices.periodStart, subscription.periodStart),
      ),
    )
    .orderBy(asc(invoices.createdAt))
    .for("update");
  let remaining = amountCents;
  for (const source of sources) {
    if (remaining === 0) break;
    const existingCredits = await tx.select().from(credits).where(eq(credits.invoiceId, source.id));
    const eligible =
      source.totalCents - existingCredits.reduce((sum, credit) => sum + credit.amountCents, 0);
    const amount = Math.min(remaining, Math.max(0, eligible));
    if (amount === 0) continue;
    const appliedCents = Math.min(amount, invoiceOutstanding(source));
    const id = crypto.randomUUID();
    await tx.insert(credits).values({
      amountCents: amount,
      appliedCents,
      customerId: subscription.customerId,
      id,
      invoiceId: source.id,
      number: `CN-${id.slice(0, 8).toUpperCase()}`,
      operationKey: `${key}:${source.id}`,
      reason,
      subscriptionId: subscription.id,
    });
    await tx
      .update(invoices)
      .set({
        creditedCents: source.creditedCents + appliedCents,
        status: invoiceOutstanding(source) === appliedCents ? "PAID" : "UNPAID",
      })
      .where(eq(invoices.id, source.id));
    remaining -= amount;
  }
  if (remaining > 0) throw new DomainError("Credit would exceed eligible billed service", 409);
}

export async function changeSubscription(
  actor: Actor,
  id: string,
  input: {
    operationKey: string;
    productId?: string;
    quantity?: number;
    reason: string;
    version: number;
  },
  cancel = false,
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, id))
      .for("update");
    if (!locked) throw new DomainError("Subscription not found", 404);
    const fingerprint = JSON.stringify({
      cancel,
      productId: input.productId ?? null,
      quantity: input.quantity ?? null,
      reason: input.reason,
      version: input.version,
    });
    const [previous] = await tx
      .select()
      .from(auditEntries)
      .where(
        and(
          eq(auditEntries.entityId, id),
          eq(auditEntries.actorId, actor.id),
          sql`${auditEntries.detail}->>'operationKey' = ${input.operationKey}`,
        ),
      );
    if (previous) {
      if (previous.detail?.fingerprint !== fingerprint)
        throw new DomainError("Operation key was reused with different input", 409);
      return locked;
    }
    if (locked.status !== "ACTIVE") throw new DomainError("Subscription is already cancelled", 409);
    if (locked.version !== input.version)
      throw new DomainError("Subscription changed. Refresh and try again.", 409);
    const { subscription, base } = await catchUpSubscription(tx, locked, now);
    let newNet = subscription.periodNetCents;
    let quantity = input.quantity ?? subscription.quantity;
    let productId = subscription.productId;
    let name = subscription.name;
    let priceCents = subscription.priceCents;
    let priceBasisCents = subscription.priceBasisCents;
    let priceBasisQuantity = subscription.priceBasisQuantity;
    if (cancel) {
      newNet = 0;
    } else if (input.productId && input.productId !== subscription.productId) {
      const [product] = await tx.select().from(products).where(eq(products.id, input.productId));
      if (
        !product?.active ||
        product.intervalMonths !== subscription.intervalMonths ||
        product.taxBps !== subscription.taxBps
      )
        throw new DomainError("Choose an active plan with the same cadence and tax rate", 409);
      productId = product.id;
      name = product.name;
      priceCents = product.priceCents;
      priceBasisCents = product.priceCents;
      priceBasisQuantity = 1;
      newNet = periodCharge(product.priceCents, quantity);
    } else {
      newNet = roundRatioHalfUp(
        subscription.priceBasisCents,
        quantity,
        subscription.priceBasisQuantity,
      );
      priceCents = roundRatioHalfUp(newNet, 1, quantity);
    }
    const oldTotal =
      subscription.periodNetCents +
      roundRatioHalfUp(subscription.periodNetCents, subscription.taxBps, 10000);
    const newTotal = newNet + roundRatioHalfUp(newNet, subscription.taxBps, 10000);
    if (newTotal > 2_147_483_647)
      throw new DomainError(
        "Subscription charge exceeds the supported amount. Reduce the quantity.",
      );
    const start = new Date(subscription.periodStart),
      end = new Date(subscription.periodEnd);
    const delta = proratedAdjustment(oldTotal, newTotal, start, end, now);
    const key = `change:${id}:${input.operationKey}`;
    if (delta < 0) await issueCredits(tx, subscription, -delta, key, input.reason);
    if (delta > 0) {
      const net = Math.min(
        delta,
        Math.max(0, proratedAdjustment(subscription.periodNetCents, newNet, start, end, now)),
      );
      const tax = delta - net;
      const line = {
        ...subscriptionLine(subscription, base),
        name: `${name} - prorated adjustment`,
        netCents: net,
        priceCents: net,
        quantity: 1,
        taxCents: tax,
        totalCents: delta,
      };
      await issueInvoice(tx, {
        customerId: subscription.customerId,
        dueDate: dateKey(now),
        kind: "ADJUSTMENT",
        lines: [line],
        operationKey: key,
        orderId: subscription.orderId,
        periodEnd: subscription.periodEnd,
        periodStart: subscription.periodStart,
        subscriptionId: id,
        subtotalCents: net,
        taxCents: tax,
        totalCents: delta,
      });
    }
    const [updated] = await tx
      .update(subscriptions)
      .set({
        name,
        periodNetCents: cancel ? subscription.periodNetCents : newNet,
        priceBasisCents,
        priceBasisQuantity,
        priceCents,
        productId,
        quantity,
        status: cancel ? "CANCELLED" : "ACTIVE",
        version: subscription.version + 1,
      })
      .where(eq(subscriptions.id, id))
      .returning();
    await audit(
      tx,
      actor,
      id,
      cancel ? "SUBSCRIPTION_CANCELLED" : "SUBSCRIPTION_CHANGED",
      input.reason,
      { adjustmentCents: delta, fingerprint, operationKey: input.operationKey },
    );
    return updated;
  });
}

export async function runDueBilling(actor: Actor, now = new Date()) {
  const due = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(and(eq(subscriptions.status, "ACTIVE"), lte(subscriptions.periodEnd, dateKey(now))))
    .orderBy(asc(subscriptions.periodEnd), asc(subscriptions.id))
    .limit(200);
  let issued = 0;
  for (const entry of due) {
    issued += await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, entry.id))
        .for("update");
      if (!locked || locked.status !== "ACTIVE") return 0;
      const result = await catchUpSubscription(tx, locked, now);
      if (result.issued)
        await audit(tx, actor, entry.id, "BILLING_RUN", "Issued due recurring periods", {
          issued: result.issued,
        });
      return result.issued;
    });
  }
  return { checked: due.length, issued, moreMayRemain: due.length === 200 };
}
