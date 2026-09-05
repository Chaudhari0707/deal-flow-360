import { eq } from "drizzle-orm";

import {
  cadenceForMonths,
  dateKey,
  issueInvoice,
  subscriptionLine,
} from "@/features/billing/creation";
import { nextPeriodEnd } from "@/features/billing/rules";
import type { DbTransaction } from "@/lib/db/_types/database";
import { subscriptions } from "@/lib/db/schema/billing";
import { orders } from "@/lib/db/schema/commerce";
import { DomainError } from "@/server/errors";

/** Caller holds the subscription row lock; invoices have a unique subscription/period key. */
export async function catchUpSubscription(
  tx: DbTransaction,
  current: typeof subscriptions.$inferSelect,
  now: Date,
) {
  let subscription = current;
  let issued = 0;
  const [order] = await tx.select().from(orders).where(eq(orders.id, current.orderId));
  const base = order?.lines.find((line) => `${order.id}:${line.id}` === current.id);
  if (!base) throw new DomainError("Subscription source line is missing", 409);
  while (subscription.status === "ACTIVE" && subscription.periodEnd <= dateKey(now)) {
    if (issued >= 120)
      throw new DomainError(
        "Subscription exceeds 120 catch-up periods; requires finance review",
        409,
      );
    const start = subscription.periodEnd;
    const end = dateKey(
      nextPeriodEnd(
        new Date(start),
        cadenceForMonths(subscription.intervalMonths),
        subscription.anchorDay,
      ),
    );
    const line = subscriptionLine(subscription, base);
    await issueInvoice(tx, {
      customerId: subscription.customerId,
      dueDate: start,
      kind: "RECURRING",
      lines: [line],
      operationKey: `subscription:${subscription.id}:${start}`,
      orderId: subscription.orderId,
      periodEnd: end,
      periodStart: start,
      subscriptionId: subscription.id,
      subtotalCents: line.netCents,
      taxCents: line.taxCents,
      totalCents: line.totalCents,
    });
    const [updated] = await tx
      .update(subscriptions)
      .set({ periodEnd: end, periodStart: start, version: subscription.version + 1 })
      .where(eq(subscriptions.id, subscription.id))
      .returning();
    if (!updated) throw new DomainError("Subscription disappeared", 409);
    subscription = updated;
    issued += 1;
  }
  return { issued, subscription, base };
}
