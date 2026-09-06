import { eq } from "drizzle-orm";

import { createOrderBilling, dateKey } from "@/features/billing/creation";
import { calculateQuote, defaultDiscounts, priceLines } from "@/features/quotes/rules";
import type { BulkSeedOptions } from "@/lib/db/_types/bulk-seed";
import type { DbTransaction } from "@/lib/db/_types/database";
import * as s from "@/lib/db/schema";

export async function seedBulkScenario(
  tx: DbTransaction,
  options: BulkSeedOptions,
  index: number,
  actors: { repId: string; financeId: string; opsId: string; customerUserId: string },
  customer: typeof s.customers.$inferSelect,
) {
  const prefix = customer.id;
  const id = (kind: string) => `${prefix}-${kind}`;
  const asOf = new Date(`${options.asOf}T00:00:00.000Z`);
  const createdAt = new Date(asOf.getTime() - ((index % 60) + 1) * 86400000);
  const promisedDate = dateKey(new Date(asOf.getTime() + ((index % 14) - 4) * 86400000));
  const warehouseId = `bulk-${options.batch}-warehouse-${(index % 3) + 1}`;
  const productValues = [
    {
      id: id("hardware"),
      name: `Sample ${options.batch} workstation ${index + 1}`,
      category: "Hardware",
      priceCents: 100000 + index * 1250,
      costCents: 45000 + index * 500,
      taxBps: 1800,
      stockable: true,
      intervalMonths: 0,
      variant: "Standard",
      pairedProductIds: [id("plan")],
    },
    {
      id: id("plan"),
      name: `Sample ${options.batch} care plan ${index + 1}`,
      category: "Subscription",
      priceCents: 10000 + index * 100,
      costCents: 3000 + index * 25,
      taxBps: 1800,
      stockable: false,
      intervalMonths: [1, 3, 12][index % 3]!,
      variant: ["Monthly", "Quarterly", "Yearly"][index % 3]!,
      pairedProductIds: [],
    },
  ];
  await tx.insert(s.products).values(productValues);
  const quantity = (index % 5) + 2;
  for (const pending of [false, true]) {
    const quoteId = id(pending ? "approval" : "quote");
    const discountBps = pending ? defaultDiscounts[customer.tier]! + (index % 2 ? 600 : 200) : 200;
    const values = calculateQuote(
      priceLines(productValues, customer.tier, [
        { productId: id("hardware"), quantity, discountBps },
        { productId: id("plan"), quantity: 1, discountBps: pending ? 0 : 100, upsell: true },
      ]),
      0,
      customer.tier,
    );
    await tx.insert(s.quotes).values({
      id: quoteId,
      number: quoteId,
      customerId: customer.id,
      ownerId: actors.repId,
      ...values,
      status: pending ? "PENDING_APPROVAL" : "CONFIRMED",
      revision: 1,
      approvedRevision: pending ? null : 1,
      approvalStep: pending ? "manager" : null,
      notes: "Synthetic bulk seed; amounts use the default tier/pricing policy in INR.",
      promisedDate,
      createdAt,
      updatedAt: createdAt,
    });
    await tx.insert(s.quoteRevisions).values({
      id: `${quoteId}-r1`,
      quoteId,
      revision: 1,
      lines: values.lines,
      riskSnapshot: values.riskSnapshot,
      createdAt,
    });
    await tx.insert(s.auditEntries).values({
      id: `${quoteId}-submitted`,
      entityId: quoteId,
      actorId: actors.repId,
      actorName: "Sample sales representative",
      action: "QUOTE_SUBMITTED",
      revision: 1,
      reason: "Synthetic review scenario",
      detail: { risk: values.riskSnapshot },
      createdAt,
    });
    if (pending) continue;
    await tx.insert(s.auditEntries).values([
      {
        id: id("approved"),
        entityId: quoteId,
        actorName: "Automatic approval",
        action: "AUTO_APPROVED",
        revision: 1,
        createdAt,
      },
      {
        id: id("confirmed"),
        entityId: quoteId,
        actorId: actors.customerUserId,
        actorName: customer.name,
        action: "QUOTE_CONFIRMED",
        revision: 1,
        createdAt,
      },
    ]);
    await tx.insert(s.messages).values([
      {
        id: id("question"),
        quoteId,
        authorId: actors.customerUserId,
        authorName: customer.name,
        body: "Sample question: can you confirm the delivery schedule?",
        createdAt,
      },
      {
        id: id("reply"),
        quoteId,
        authorId: actors.repId,
        authorName: "Sample sales representative",
        body: "Sample reply: the agreed delivery date is recorded on this quotation.",
        createdAt: new Date(createdAt.getTime() + 60000),
      },
    ]);
    const stage = ["READY", "BACKORDER", "SPLIT_PENDING", "FULFILLED"][index % 4]!;
    const shipped = stage === "FULFILLED" ? quantity : 0;
    const reservedQuantity = stage === "BACKORDER" ? quantity - 1 : quantity;
    const reserved = reservedQuantity - shipped;
    const onHand = stage === "BACKORDER" ? reserved : reserved + 20;
    const [order] = await tx
      .insert(s.orders)
      .values({
        id: id("order"),
        number: id("SO"),
        quoteId,
        customerId: customer.id,
        lines: values.lines,
        fulfillmentStatus: stage,
        acceptedAt: stage === "SPLIT_PENDING" ? null : createdAt,
        promisedDate,
        createdAt,
      })
      .returning();
    await tx
      .insert(s.stocks)
      .values({ id: id("stock"), warehouseId, productId: id("hardware"), onHand, reserved });
    await tx.insert(s.reservations).values({
      id: id("reservation"),
      orderId: order!.id,
      warehouseId,
      productId: id("hardware"),
      quantity: reservedQuantity,
      shipped,
    });
    await tx.insert(s.stockMovements).values({
      id: id("restock"),
      operationKey: id("restock"),
      warehouseId,
      productId: id("hardware"),
      actorId: actors.opsId,
      quantity: onHand + shipped,
      kind: "RESTOCK",
      reason: "Synthetic opening stock",
      createdAt,
    });
    if (shipped)
      await tx.insert(s.stockMovements).values({
        id: id("shipment"),
        operationKey: id("shipment"),
        warehouseId,
        productId: id("hardware"),
        orderId: order!.id,
        actorId: actors.opsId,
        quantity: shipped,
        kind: "SHIP",
        reason: "Synthetic dispatch",
        createdAt,
      });
    await createOrderBilling(tx, order!, createdAt);
    await tx
      .update(s.subscriptions)
      .set({ createdAt })
      .where(eq(s.subscriptions.orderId, order!.id));
    await tx.update(s.invoices).set({ createdAt }).where(eq(s.invoices.orderId, order!.id));
    const invoices = await tx.select().from(s.invoices).where(eq(s.invoices.orderId, order!.id));
    for (const invoice of invoices) {
      // Stable visible numbers; the production billing service owns invoice IDs and operation keys.
      await tx
        .update(s.invoices)
        .set({ number: id(invoice.kind === "ONE_TIME" ? "INV" : "REC") })
        .where(eq(s.invoices.id, invoice.id));
      if (invoice.kind !== "ONE_TIME") continue;
      const creditedCents = Math.floor(invoice.totalCents / 10);
      const paidCents =
        index % 2
          ? Math.floor((invoice.totalCents - creditedCents) / 2)
          : invoice.totalCents - creditedCents;
      await tx.insert(s.credits).values({
        id: id("credit"),
        number: id("CN"),
        operationKey: id("credit"),
        invoiceId: invoice.id,
        customerId: customer.id,
        amountCents: creditedCents,
        appliedCents: creditedCents,
        reason: "Synthetic goodwill credit",
        createdAt,
      });
      await tx.insert(s.payments).values({
        id: id("payment"),
        operationKey: id("payment"),
        invoiceId: invoice.id,
        amountCents: paidCents,
        reference: "SYNTHETIC-TRANSFER",
        actorId: actors.financeId,
        createdAt,
      });
      await tx
        .update(s.invoices)
        .set({
          creditedCents,
          paidCents,
          status: paidCents + creditedCents === invoice.totalCents ? "PAID" : "UNPAID",
        })
        .where(eq(s.invoices.id, invoice.id));
    }
  }
}
