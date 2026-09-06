import { eq } from "drizzle-orm";

import type { BillingCadence } from "@/features/billing/_types/billing";
import {
  calendarDate,
  invoiceOutstanding,
  nextPeriodEnd,
  roundRatioHalfUp,
} from "@/features/billing/rules";
import type { DbTransaction } from "@/lib/db/_types/database";
import { invoices, subscriptions } from "@/lib/db/schema/billing";
import type { orders } from "@/lib/db/schema/commerce";
import type { QuoteLine } from "@/lib/domain/_types/domain";
import { DomainError } from "@/server/errors";

export function cadenceForMonths(months: number): BillingCadence {
  if (months === 1) return "monthly";
  if (months === 3) return "quarterly";
  if (months === 12) return "yearly";
  throw new DomainError("Billing cadence must be monthly, quarterly or yearly");
}

export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function issueInvoice(
  tx: DbTransaction,
  data: Omit<typeof invoices.$inferInsert, "id" | "number">,
) {
  const id = crypto.randomUUID();
  const [invoice] = await tx
    .insert(invoices)
    .values({
      ...data,
      id,
      number: `INV-${id.slice(0, 8).toUpperCase()}`,
      status:
        invoiceOutstanding({
          totalCents: data.totalCents,
          paidCents: data.paidCents ?? 0,
          creditedCents: data.creditedCents ?? 0,
        }) === 0
          ? "PAID"
          : (data.status ?? "UNPAID"),
    })
    .onConflictDoNothing({ target: invoices.operationKey })
    .returning();
  if (invoice) return invoice;
  const [existing] = await tx
    .select()
    .from(invoices)
    .where(eq(invoices.operationKey, data.operationKey));
  if (!existing) throw new DomainError("Invoice retry could not be resolved", 409);
  return existing;
}

export async function createOrderBilling(
  tx: DbTransaction,
  order: typeof orders.$inferSelect,
  now: Date,
) {
  const issued = [];
  const oneTime = order.lines.filter((line) => line.intervalMonths === 0);
  const start = calendarDate(now);
  if (oneTime.length) {
    const due = new Date(start);
    due.setUTCDate(due.getUTCDate() + 14);
    issued.push(
      await issueInvoice(tx, {
        customerId: order.customerId,
        dueDate: dateKey(due),
        kind: "ONE_TIME",
        lines: oneTime,
        operationKey: `order:${order.id}:one-time`,
        orderId: order.id,
        subtotalCents: oneTime.reduce((sum, line) => sum + line.netCents, 0),
        taxCents: oneTime.reduce((sum, line) => sum + line.taxCents, 0),
        totalCents: oneTime.reduce((sum, line) => sum + line.totalCents, 0),
      }),
    );
  }
  for (const line of order.lines.filter((entry) => entry.intervalMonths > 0)) {
    const id = `${order.id}:${line.id}`;
    const end = nextPeriodEnd(start, cadenceForMonths(line.intervalMonths));
    const [subscription] = await tx
      .insert(subscriptions)
      .values({
        anchorDay: start.getUTCDate(),
        customerId: order.customerId,
        id,
        intervalMonths: line.intervalMonths,
        name: line.name,
        orderId: order.id,
        periodEnd: dateKey(end),
        periodNetCents: line.netCents,
        periodStart: dateKey(start),
        priceBasisCents: line.netCents,
        priceBasisQuantity: line.quantity,
        priceCents: roundRatioHalfUp(line.netCents, 1, line.quantity),
        productId: line.productId,
        quantity: line.quantity,
        taxBps: line.taxBps,
      })
      .onConflictDoNothing()
      .returning();
    if (!subscription) continue;
    issued.push(
      await issueInvoice(tx, {
        customerId: order.customerId,
        dueDate: dateKey(start),
        kind: "RECURRING",
        lines: [line],
        operationKey: `subscription:${id}:${dateKey(start)}`,
        orderId: order.id,
        periodEnd: dateKey(end),
        periodStart: dateKey(start),
        subscriptionId: id,
        subtotalCents: line.netCents,
        taxCents: line.taxCents,
        totalCents: line.totalCents,
      }),
    );
  }
  return issued;
}

export function subscriptionLine(
  subscription: typeof subscriptions.$inferSelect,
  base: QuoteLine,
): QuoteLine {
  const taxCents = roundRatioHalfUp(subscription.periodNetCents, subscription.taxBps, 10000);
  return {
    ...base,
    intervalMonths: subscription.intervalMonths,
    name: subscription.name,
    netCents: subscription.periodNetCents,
    priceCents: subscription.priceCents,
    productId: subscription.productId,
    quantity: subscription.quantity,
    taxBps: subscription.taxBps,
    taxCents,
    totalCents: subscription.periodNetCents + taxCents,
  };
}
