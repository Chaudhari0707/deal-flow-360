import { asc, eq, inArray, sql } from "drizzle-orm";
import { Resend } from "resend";

import { invoicePdf } from "@/features/billing/documents";
import { senderAddress } from "@/features/quotes/sender-address";
import type { DbTransaction } from "@/lib/db/_types/database";
import { db } from "@/lib/db/connection";
import { invoiceDeliveries, invoices } from "@/lib/db/schema/billing";
import { customers, orders, quotes } from "@/lib/db/schema/commerce";
import type { Actor } from "@/lib/domain/_types/domain";
import { audit } from "@/server/audit";
import { DomainError } from "@/server/errors";

const EMAIL_ADDRESS = /^[^\s<>]+@[^\s<>]+$/;
const RESEND_TEST_RECIPIENT =
  /^(delivered|bounced|complained|suppressed)(\+[a-zA-Z0-9_-]+)?@resend\.dev$/;

export async function queueOrderInvoiceEmail(
  tx: DbTransaction,
  orderId: string,
  recipient: string,
  invoiceIds: string[],
) {
  if (invoiceIds.length === 0) throw new DomainError("Confirmed order has no invoices", 503);
  await tx
    .insert(invoiceDeliveries)
    .values({ id: crypto.randomUUID(), invoiceIds, orderId, recipient })
    .onConflictDoNothing({ target: invoiceDeliveries.orderId });
}

type InvoiceEmailRecord = {
  customer: typeof customers.$inferSelect;
  invoice: typeof invoices.$inferSelect;
  order: typeof orders.$inferSelect;
  quote: typeof quotes.$inferSelect;
};

function attachment(record: InvoiceEmailRecord) {
  const { customer, invoice, order, quote } = record;
  return invoicePdf({
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
    sourceNumber: `${order.number} · ${quote.number}`,
    status: invoice.status,
    subtotalCents: invoice.subtotalCents,
    taxCents: invoice.taxCents,
    totalCents: invoice.totalCents,
  }).then((content) => ({
    content: content.toBase64(),
    contentType: "application/pdf",
    filename: `${invoice.number}.pdf`,
  }));
}

export async function sendOrderInvoiceEmail(orderId: string, actor: Actor) {
  const intent = await db.transaction(async (tx) => {
    const [delivery] = await tx
      .select()
      .from(invoiceDeliveries)
      .where(eq(invoiceDeliveries.orderId, orderId))
      .for("update");
    if (!delivery) throw new DomainError("Invoice email delivery was not queued", 404);
    if (delivery.status === "SENT") return { delivery, records: [] as InvoiceEmailRecord[] };
    const records = await tx
      .select({ customer: customers, invoice: invoices, order: orders, quote: quotes })
      .from(invoices)
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .innerJoin(orders, eq(invoices.orderId, orders.id))
      .innerJoin(quotes, eq(orders.quoteId, quotes.id))
      .where(inArray(invoices.id, delivery.invoiceIds))
      .orderBy(asc(invoices.createdAt), asc(invoices.id));
    if (records.length !== delivery.invoiceIds.length)
      throw new DomainError("Confirmed invoice files are unavailable", 503);
    return { delivery, records };
  });
  if (intent.delivery.status === "SENT")
    return { deliveryId: intent.delivery.id, status: "SENT" as const };

  let error: string | null = null;
  let providerId: string | null = null;
  if (
    Bun.env.EMAIL_TRANSPORT === "test" &&
    new URL(Bun.env.DATABASE_URL!).pathname.endsWith("_test")
  ) {
    providerId = `test-${intent.delivery.id}`;
  } else if (!Bun.env.RESEND_API_KEY) {
    error = "Resend is not configured. Configure RESEND_API_KEY and retry.";
  } else if (!EMAIL_ADDRESS.test(intent.delivery.recipient)) {
    error = "Customer invoice email address is invalid. Update the customer contact and retry.";
  } else {
    const override = Bun.env.EMAIL_TEST_RECIPIENT;
    if (override && !RESEND_TEST_RECIPIENT.test(override))
      error = "EMAIL_TEST_RECIPIENT must be a supported Resend test sink.";
    else {
      try {
        const attachments = await Promise.all(intent.records.map(attachment));
        const invoicesLabel =
          intent.records.length === 1 ? "invoice PDF" : `${intent.records.length} invoice PDFs`;
        const order = intent.records[0]!.order;
        const result = await new Resend(Bun.env.RESEND_API_KEY).emails.send(
          {
            attachments,
            from: senderAddress(Bun.env.EMAIL_FROM ?? "DealFlow360 <onboarding@resend.dev>"),
            subject:
              intent.records.length === 1
                ? `${intent.records[0]!.invoice.number} — your invoice`
                : `Invoices for order ${order.number}`,
            text: `Hello ${intent.records[0]!.customer.name},\n\nYour order ${order.number} is confirmed. Your ${invoicesLabel} ${intent.records.length === 1 ? "is" : "are"} attached.\n\nDealFlow360`,
            to: override || intent.delivery.recipient,
          },
          { idempotencyKey: `order-invoices-${intent.delivery.id}` },
        );
        if (result.error)
          error =
            "Email provider rejected the send. Check the configured sender and recipient, then retry.";
        else if (result.data?.id) providerId = result.data.id;
        else error = "Email provider did not confirm acceptance. Retry this delivery.";
      } catch {
        error = "Email provider is unavailable. Retry this delivery.";
      }
    }
  }

  const outcome = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(invoiceDeliveries)
      .set({
        attempts: sql`${invoiceDeliveries.attempts} + 1`,
        error: error
          ? sql`case when ${invoiceDeliveries.status} = 'SENT' then null else ${error} end`
          : null,
        providerId: providerId ?? sql`${invoiceDeliveries.providerId}`,
        status: error
          ? sql`case when ${invoiceDeliveries.status} = 'SENT' then 'SENT' else 'FAILED' end`
          : "SENT",
      })
      .where(eq(invoiceDeliveries.id, intent.delivery.id))
      .returning();
    await audit(
      tx,
      actor,
      orderId,
      error ? "INVOICE_EMAIL_ATTEMPT_FAILED" : "INVOICE_EMAIL_SENT",
      error ?? "Invoice email accepted by provider",
      { deliveryId: intent.delivery.id, invoiceCount: intent.delivery.invoiceIds.length },
    );
    return updated!;
  });
  return {
    deliveryId: outcome.id,
    status: outcome.status === "SENT" ? ("SENT" as const) : ("FAILED" as const),
  };
}
