import { and, eq } from "drizzle-orm";

import { createOrderBilling, dateKey } from "@/features/billing/creation";
import { invoiceOutstanding } from "@/features/billing/rules";
import { calculateQuote, priceLines } from "@/features/quotes/rules";
import type { DbTransaction } from "@/lib/db/_types/database";
import * as s from "@/lib/db/schema";
import { customerRows, productRows } from "@/lib/db/seed/demo-data";
import type { QuoteLine } from "@/lib/domain/_types/domain";

type LineInput = { productId: string; quantity: number; discountBps: number };

/**
 * Deterministic invoice matrix for Finance manual testing.
 * Fixed invoice numbers so each status/kind is easy to find in the register.
 * Safe to re-run: skips when Q-INV-UNPAID already exists.
 */
export async function seedInvoiceStatusFixtures(
  tx: DbTransaction,
  input: { financeId: string; repId: string },
) {
  const [existing] = await tx.select().from(s.quotes).where(eq(s.quotes.id, "Q-INV-UNPAID"));
  if (existing) return;

  const now = new Date();
  const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);
  const ahead = (days: number) => dateKey(new Date(now.getTime() + days * 86_400_000));

  async function confirmFixture(fixture: {
    quoteId: string;
    orderId: string;
    orderNumber: string;
    customerId: string;
    lines: LineInput[];
    createdDaysAgo: number;
  }) {
    const customer = customerRows.find((row) => row.id === fixture.customerId)!;
    const values = calculateQuote(
      priceLines(productRows, customer.tier, fixture.lines),
      0,
      customer.tier,
    );
    const createdAt = ago(fixture.createdDaysAgo);
    await tx.insert(s.quotes).values({
      id: fixture.quoteId,
      number: fixture.quoteId,
      customerId: customer.id,
      ownerId: input.repId,
      ...values,
      status: "CONFIRMED",
      revision: 1,
      approvedRevision: 1,
      createdAt,
      updatedAt: createdAt,
      promisedDate: ahead(7),
    });
    await tx.insert(s.quoteRevisions).values({
      id: `${fixture.quoteId}-r1`,
      quoteId: fixture.quoteId,
      revision: 1,
      lines: values.lines,
      riskSnapshot: values.riskSnapshot,
      createdAt,
    });
    const [order] = await tx
      .insert(s.orders)
      .values({
        id: fixture.orderId,
        quoteId: fixture.quoteId,
        number: fixture.orderNumber,
        customerId: customer.id,
        lines: values.lines,
        createdAt,
        promisedDate: ahead(7),
        fulfillmentStatus: "FULFILLED",
      })
      .returning();
    await createOrderBilling(tx, order!, createdAt);
    await tx.update(s.invoices).set({ createdAt }).where(eq(s.invoices.orderId, order!.id));
    await tx
      .update(s.subscriptions)
      .set({ createdAt })
      .where(eq(s.subscriptions.orderId, order!.id));
    return order!;
  }

  async function renameInvoice(orderId: string, kind: string, number: string) {
    const [invoice] = await tx
      .select()
      .from(s.invoices)
      .where(and(eq(s.invoices.orderId, orderId), eq(s.invoices.kind, kind)));
    if (!invoice) throw new Error(`Missing ${kind} invoice for ${orderId}`);
    await tx.update(s.invoices).set({ number }).where(eq(s.invoices.id, invoice.id));
    const [updated] = await tx.select().from(s.invoices).where(eq(s.invoices.id, invoice.id));
    return updated!;
  }

  // 1) UNPAID one-time — record a full payment against this
  await confirmFixture({
    quoteId: "Q-INV-UNPAID",
    orderId: "order-inv-unpaid",
    orderNumber: "SO-INV-UNPAID",
    customerId: "acme",
    lines: [{ productId: "mouse", quantity: 3, discountBps: 0 }],
    createdDaysAgo: 3,
  });
  await renameInvoice("order-inv-unpaid", "ONE_TIME", "INV-SEED-UNPAID");

  // 2) OVERDUE unpaid one-time — due date in the past (Deal Health overdue)
  await confirmFixture({
    quoteId: "Q-INV-OVERDUE",
    orderId: "order-inv-overdue",
    orderNumber: "SO-INV-OVERDUE",
    customerId: "beta",
    lines: [{ productId: "dock", quantity: 1, discountBps: 0 }],
    createdDaysAgo: 45,
  });
  const overdue = await renameInvoice("order-inv-overdue", "ONE_TIME", "INV-SEED-OVERDUE");
  await tx
    .update(s.invoices)
    .set({ dueDate: dateKey(ago(20)) })
    .where(eq(s.invoices.id, overdue.id));

  // 3) PAID one-time with cash payment ledger
  await confirmFixture({
    quoteId: "Q-INV-PAID",
    orderId: "order-inv-paid",
    orderNumber: "SO-INV-PAID",
    customerId: "nova",
    lines: [{ productId: "mouse", quantity: 1, discountBps: 0 }],
    createdDaysAgo: 12,
  });
  const paid = await renameInvoice("order-inv-paid", "ONE_TIME", "INV-SEED-PAID");
  await tx.insert(s.payments).values({
    id: "pay-seed-paid",
    invoiceId: paid.id,
    operationKey: "seed-pay-INV-SEED-PAID",
    amountCents: paid.totalCents,
    reference: "SEED-BANK-PAID",
    actorId: input.financeId,
    createdAt: ago(10),
  });
  await tx
    .update(s.invoices)
    .set({ paidCents: paid.totalCents, status: "PAID" })
    .where(eq(s.invoices.id, paid.id));

  // 4) FREE / fully discounted — PAID with $0 and no payment row
  await confirmFixture({
    quoteId: "Q-INV-FREE",
    orderId: "order-inv-free",
    orderNumber: "SO-INV-FREE",
    customerId: "delta",
    lines: [{ productId: "mouse", quantity: 2, discountBps: 10000 }],
    createdDaysAgo: 5,
  });
  await renameInvoice("order-inv-free", "ONE_TIME", "INV-SEED-FREE");

  // 5) Hybrid order — separate ONE_TIME + RECURRING (PDF: billed separately)
  await confirmFixture({
    quoteId: "Q-INV-HYBRID",
    orderId: "order-inv-hybrid",
    orderNumber: "SO-INV-HYBRID",
    customerId: "zenith",
    lines: [
      { productId: "setup", quantity: 1, discountBps: 0 },
      { productId: "care2", quantity: 1, discountBps: 0 },
    ],
    createdDaysAgo: 2,
  });
  await renameInvoice("order-inv-hybrid", "ONE_TIME", "INV-SEED-HYBRID-OT");
  await renameInvoice("order-inv-hybrid", "RECURRING", "INV-SEED-HYBRID-RC");

  // 6) Partial credit on unpaid invoice — still UNPAID
  await confirmFixture({
    quoteId: "Q-INV-CREDIT-OPEN",
    orderId: "order-inv-credit-open",
    orderNumber: "SO-INV-CREDIT-OPEN",
    customerId: "harbor",
    lines: [{ productId: "setup", quantity: 1, discountBps: 0 }],
    createdDaysAgo: 8,
  });
  const creditOpen = await renameInvoice(
    "order-inv-credit-open",
    "ONE_TIME",
    "INV-SEED-CREDIT-OPEN",
  );
  const partial = Math.max(1, Math.floor(creditOpen.totalCents / 2));
  await tx.insert(s.credits).values({
    id: "credit-seed-open",
    number: "CN-SEED-OPEN",
    invoiceId: creditOpen.id,
    customerId: creditOpen.customerId,
    operationKey: "seed-credit-INV-SEED-CREDIT-OPEN",
    amountCents: partial,
    appliedCents: partial,
    reason: "Seed: goodwill credit for delayed delivery",
    createdAt: ago(1),
  });
  const openOutstanding = invoiceOutstanding({ ...creditOpen, creditedCents: partial });
  await tx
    .update(s.invoices)
    .set({
      creditedCents: partial,
      status: openOutstanding === 0 ? "PAID" : "UNPAID",
    })
    .where(eq(s.invoices.id, creditOpen.id));

  // 7) Settled entirely by credit — PAID, no cash payment
  await confirmFixture({
    quoteId: "Q-INV-CREDIT-SET",
    orderId: "order-inv-credit-set",
    orderNumber: "SO-INV-CREDIT-SET",
    customerId: "northwind",
    lines: [{ productId: "mouse", quantity: 1, discountBps: 0 }],
    createdDaysAgo: 9,
  });
  const creditSet = await renameInvoice("order-inv-credit-set", "ONE_TIME", "INV-SEED-CREDIT-SET");
  await tx.insert(s.credits).values({
    id: "credit-seed-set",
    number: "CN-SEED-SET",
    invoiceId: creditSet.id,
    customerId: creditSet.customerId,
    operationKey: "seed-credit-INV-SEED-CREDIT-SET",
    amountCents: creditSet.totalCents,
    appliedCents: creditSet.totalCents,
    reason: "Seed: full credit settlement (not a cash refund)",
    createdAt: ago(1),
  });
  await tx
    .update(s.invoices)
    .set({ creditedCents: creditSet.totalCents, paidCents: 0, status: "PAID" })
    .where(eq(s.invoices.id, creditSet.id));

  // 8) Cash-paid + leftover available customer credit (manual apply to other invoices; no auto-apply)

  await confirmFixture({
    quoteId: "Q-INV-CREDIT-BANK",
    orderId: "order-inv-credit-bank",
    orderNumber: "SO-INV-CREDIT-BANK",
    customerId: "orion",
    lines: [{ productId: "dock", quantity: 1, discountBps: 0 }],
    createdDaysAgo: 15,
  });
  const creditBank = await renameInvoice(
    "order-inv-credit-bank",
    "ONE_TIME",
    "INV-SEED-CREDIT-BANK",
  );
  await tx.insert(s.payments).values({
    id: "pay-seed-credit-bank",
    invoiceId: creditBank.id,
    operationKey: "seed-pay-INV-SEED-CREDIT-BANK",
    amountCents: creditBank.totalCents,
    reference: "SEED-BANK-THEN-CREDIT",
    actorId: input.financeId,
    createdAt: ago(14),
  });
  await tx
    .update(s.invoices)
    .set({ paidCents: creditBank.totalCents, status: "PAID" })
    .where(eq(s.invoices.id, creditBank.id));
  await tx.insert(s.credits).values({
    id: "credit-seed-bank",
    number: "CN-SEED-BANK",
    invoiceId: creditBank.id,
    customerId: creditBank.customerId,
    operationKey: "seed-credit-INV-SEED-CREDIT-BANK",
    amountCents: 2500,
    appliedCents: 0,
    reason: "Seed: prepaid invoice leftover becomes available customer credit",
    createdAt: ago(1),
  });

  // 9) ADJUSTMENT invoice (mid-cycle increase) on the hybrid subscription
  const [hybridSub] = await tx
    .select()
    .from(s.subscriptions)
    .where(eq(s.subscriptions.orderId, "order-inv-hybrid"));
  if (hybridSub) {
    const adjustmentTotal = 2300;
    const line: QuoteLine = {
      category: "Services",
      costCents: 0,
      discountBps: 0,
      id: "adj-line",
      intervalMonths: hybridSub.intervalMonths,
      name: `${hybridSub.name} - prorated adjustment`,
      netCents: adjustmentTotal,
      priceCents: adjustmentTotal,
      productId: hybridSub.productId,
      quantity: 1,
      stockable: false,
      taxBps: hybridSub.taxBps,
      taxCents: 0,
      totalCents: adjustmentTotal,
      variant: "Adjustment",
    };
    await tx.insert(s.invoices).values({
      id: "inv-seed-adjust",
      number: "INV-SEED-ADJUST",
      operationKey: "seed-adjust-order-inv-hybrid",
      orderId: "order-inv-hybrid",
      customerId: hybridSub.customerId,
      subscriptionId: hybridSub.id,
      kind: "ADJUSTMENT",
      lines: [line],
      subtotalCents: adjustmentTotal,
      taxCents: 0,
      totalCents: adjustmentTotal,
      paidCents: 0,
      creditedCents: 0,
      status: "UNPAID",
      dueDate: dateKey(now),
      periodStart: hybridSub.periodStart,
      periodEnd: hybridSub.periodEnd,
      createdAt: ago(1),
    });
  }
}
