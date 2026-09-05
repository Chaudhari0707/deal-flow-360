import { eq } from "drizzle-orm";

import { createOrderBilling } from "@/features/billing/creation";
import { reserveOrderStock } from "@/features/inventory/stock";
import type { QuoteInput } from "@/features/quotes/_types/quotes";
import { requiredApprovalChain } from "@/features/quotes/approval-policy";
import { calculateQuote, defaultDiscounts, priceLines } from "@/features/quotes/rules";
import { db } from "@/lib/db/connection";
import { customers, orders, products, quoteRevisions, quotes, settings } from "@/lib/db/schema";
import type { Actor, QuoteLine } from "@/lib/domain/_types/domain";
import { audit } from "@/server/audit";
import { DomainError } from "@/server/errors";

export async function saveQuote(input: QuoteInput, actor: Actor, id?: string) {
  if (!["rep", "manager", "admin"].includes(actor.role))
    throw new DomainError("Your role cannot edit quotations", 403);
  return db.transaction(async (tx) => {
    const [customer] = await tx.select().from(customers).where(eq(customers.id, input.customerId));
    if (!customer) throw new DomainError("Customer not found", 404);
    const allProducts = await tx.select().from(products).where(eq(products.active, true));
    const [policy] = await tx.select().from(settings).where(eq(settings.id, "discounts"));
    const [pricelist] = await tx.select().from(settings).where(eq(settings.id, "pricelists"));
    let existing: typeof quotes.$inferSelect | undefined;
    if (id) {
      [existing] = await tx.select().from(quotes).where(eq(quotes.id, id)).for("update");
      if (!existing || (actor.role === "rep" && existing.ownerId !== actor.id))
        throw new DomainError("Quotation not found", 404);
      if (existing.status === "CONFIRMED" || existing.status === "REJECTED")
        throw new DomainError("This quotation is closed", 409);
      if (existing.revision !== input.revision)
        throw new DomainError("Quotation changed. Reload before saving.", 409);
    }
    let amounts;
    try {
      amounts = calculateQuote(
        priceLines(allProducts, customer.tier, input.lines, pricelist?.value),
        input.orderDiscountBps,
        customer.tier,
        policy?.value ?? defaultDiscounts,
      );
    } catch (error) {
      throw new DomainError(error instanceof Error ? error.message : "Invalid quotation");
    }
    const quoteId = id ?? crypto.randomUUID();
    const values = {
      ...amounts,
      customerId: customer.id,
      orderDiscountBps: input.orderDiscountBps,
      notes: input.notes ?? "",
      promisedDate: input.promisedDate || null,
      revision: existing ? existing.revision + 1 : 1,
      approvedRevision: null,
      approvalStep: null,
      status: "DRAFT" as const,
      updatedAt: new Date(),
    };
    const [saved] = existing
      ? await tx.update(quotes).set(values).where(eq(quotes.id, quoteId)).returning()
      : await tx
          .insert(quotes)
          .values({
            ...values,
            id: quoteId,
            number: `Q-${Date.now().toString(36).toUpperCase()}-${quoteId.slice(0, 4).toUpperCase()}`,
            ownerId: actor.id,
          })
          .returning();
    await audit(
      tx,
      actor,
      quoteId,
      existing ? "QUOTE_EDITED" : "QUOTE_CREATED",
      existing ? "Commercial revision saved" : "New quotation",
      { revision: values.revision },
    );
    return saved!;
  });
}

export async function submitQuote(id: string, revision: number, actor: Actor) {
  if (!["rep", "manager", "admin"].includes(actor.role))
    throw new DomainError("Your role cannot submit quotations", 403);
  return db.transaction(async (tx) => {
    const [quote] = await tx.select().from(quotes).where(eq(quotes.id, id)).for("update");
    if (!quote || (actor.role === "rep" && quote.ownerId !== actor.id))
      throw new DomainError("Quotation not found", 404);
    if (quote.revision !== revision)
      throw new DomainError("Quotation changed. Reload before submitting.", 409);
    if (!["DRAFT", "RETURNED"].includes(quote.status))
      throw new DomainError("Only a draft or returned quote can be submitted", 409);
    const [customer] = await tx.select().from(customers).where(eq(customers.id, quote.customerId));
    const [policy] = await tx.select().from(settings).where(eq(settings.id, "discounts"));
    const [approvalPolicy] = await tx
      .select()
      .from(settings)
      .where(eq(settings.id, "approvalChain"));
    const amounts = calculateQuote(
      quote.lines,
      quote.orderDiscountBps,
      customer!.tier,
      policy?.value ?? defaultDiscounts,
    );
    const revisionNext = quote.revision + 1;
    await tx.insert(quoteRevisions).values({
      id: crypto.randomUUID(),
      quoteId: id,
      revision: revisionNext,
      lines: amounts.lines,
      riskSnapshot: amounts.riskSnapshot,
    });
    const [result] = await tx
      .update(quotes)
      .set({
        ...amounts,
        revision: revisionNext,
        status: amounts.risk === "NONE" ? "APPROVED" : "PENDING_APPROVAL",
        approvedRevision: amounts.risk === "NONE" ? revisionNext : null,
        approvalStep:
          amounts.risk === "NONE"
            ? null
            : (requiredApprovalChain(amounts.risk, approvalPolicy?.value)[0] ?? null),
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, id))
      .returning();
    await audit(
      tx,
      actor,
      id,
      amounts.risk === "NONE" ? "AUTO_APPROVED" : "QUOTE_SUBMITTED",
      `Discount risk ${amounts.risk}`,
      { revision: revisionNext, risk: amounts.riskSnapshot },
    );
    return result!;
  });
}

export async function approvalAction(
  id: string,
  revision: number,
  action: "approve" | "return" | "reject",
  reason: string,
  actor: Actor,
) {
  return db.transaction(async (tx) => {
    const [quote] = await tx.select().from(quotes).where(eq(quotes.id, id)).for("update");
    if (!quote) throw new DomainError("Quotation not found", 404);
    if (quote.status !== "PENDING_APPROVAL" || quote.revision !== revision)
      throw new DomainError("Approval is stale. Reload current quotation.", 409);
    if (actor.role !== quote.approvalStep && actor.role !== "admin")
      throw new DomainError("Only the current approval role can act", 403);
    const [approvalPolicy] = await tx
      .select()
      .from(settings)
      .where(eq(settings.id, "approvalChain"));
    const chain = requiredApprovalChain(quote.risk, approvalPolicy?.value);
    const stepIndex = chain.indexOf(quote.approvalStep as (typeof chain)[number]);
    if (stepIndex < 0) throw new DomainError("Approval chain configuration is invalid", 503);
    const next =
      action === "approve"
        ? (chain[stepIndex + 1] ?? null)
        : action === "return" && stepIndex > 0
          ? chain[stepIndex - 1]
          : null;
    const status =
      action === "return"
        ? next
          ? "PENDING_APPROVAL"
          : "RETURNED"
        : action === "reject"
          ? "REJECTED"
          : next
            ? "PENDING_APPROVAL"
            : "APPROVED";
    const [result] = await tx
      .update(quotes)
      .set({
        status,
        approvalStep: next,
        approvedRevision: status === "APPROVED" ? revision : null,
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, id))
      .returning();
    await audit(tx, actor, id, `APPROVAL_${action.toUpperCase()}`, reason, {
      revision,
      step: quote.approvalStep,
      risk: quote.riskSnapshot,
    });
    return result!;
  });
}

export async function counterQuote(
  id: string,
  revision: number,
  changes: { id: string; discountBps: number }[],
  actor: Actor,
  promisedDate?: string,
) {
  if (!["customer", "admin"].includes(actor.role))
    throw new DomainError("Only the customer or administrator demo proxy can propose terms", 403);
  return db.transaction(async (tx) => {
    const [quote] = await tx.select().from(quotes).where(eq(quotes.id, id)).for("update");
    if (!quote) throw new DomainError("Quotation not found", 404);
    if (actor.role === "customer" && actor.customerId !== quote.customerId)
      throw new DomainError("Quotation not found", 404);
    if (
      quote.revision !== revision ||
      !["APPROVED", "SENT", "UNDER_NEGOTIATION"].includes(quote.status)
    )
      throw new DomainError("Quotation is not open to negotiation", 409);
    if (changes.some((c) => !quote.lines.some((l) => l.id === c.id)))
      throw new DomainError("Unknown quotation line");
    const lines: QuoteLine[] = quote.lines.map((l) => ({
      ...l,
      discountBps: changes.find((c) => c.id === l.id)?.discountBps ?? l.discountBps,
    }));
    const [customer] = await tx.select().from(customers).where(eq(customers.id, quote.customerId));
    const [policy] = await tx.select().from(settings).where(eq(settings.id, "discounts"));
    const [approvalPolicy] = await tx
      .select()
      .from(settings)
      .where(eq(settings.id, "approvalChain"));
    const amounts = calculateQuote(
      lines,
      quote.orderDiscountBps,
      customer!.tier,
      policy?.value ?? defaultDiscounts,
    );
    const nextRevision = revision + 1;
    await tx.insert(quoteRevisions).values({
      id: crypto.randomUUID(),
      quoteId: id,
      revision: nextRevision,
      lines: amounts.lines,
      riskSnapshot: amounts.riskSnapshot,
    });
    const [result] = await tx
      .update(quotes)
      .set({
        ...amounts,
        revision: nextRevision,
        approvedRevision: amounts.risk === "NONE" ? nextRevision : null,
        status: amounts.risk === "NONE" ? "APPROVED" : "PENDING_APPROVAL",
        approvalStep:
          amounts.risk === "NONE"
            ? null
            : (requiredApprovalChain(amounts.risk, approvalPolicy?.value)[0] ?? null),
        promisedDate: promisedDate ?? quote.promisedDate,
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, id))
      .returning();
    await audit(tx, actor, id, "CUSTOMER_COUNTERED", "Customer proposed revised terms", {
      revision: nextRevision,
      risk: amounts.riskSnapshot,
    });
    return result!;
  });
}

export async function confirmQuote(id: string, revision: number, actor: Actor) {
  if (!["customer", "admin"].includes(actor.role))
    throw new DomainError("Only the customer or administrator demo proxy can accept terms", 403);
  return db.transaction(async (tx) => {
    const [quote] = await tx.select().from(quotes).where(eq(quotes.id, id)).for("update");
    if (!quote) throw new DomainError("Quotation not found", 404);
    if (actor.role === "customer" && actor.customerId !== quote.customerId)
      throw new DomainError("Quotation not found", 404);
    if (quote.revision !== revision)
      throw new DomainError("Terms changed. Review the current revision.", 409);
    if (quote.status === "CONFIRMED") {
      const [order] = await tx.select().from(orders).where(eq(orders.quoteId, id));
      return order!;
    }
    if (
      quote.approvedRevision !== revision ||
      !["APPROVED", "SENT", "UNDER_NEGOTIATION"].includes(quote.status)
    )
      throw new DomainError("Current terms still require approval", 409);
    const [order] = await tx
      .insert(orders)
      .values({
        id: crypto.randomUUID(),
        quoteId: id,
        number: quote.number.replace("Q-", "SO-"),
        customerId: quote.customerId,
        lines: quote.lines,
        promisedDate: quote.promisedDate,
      })
      .returning();
    await reserveOrderStock(tx, order!, actor);
    await createOrderBilling(tx, order!, new Date());
    await tx
      .update(quotes)
      .set({ status: "CONFIRMED", updatedAt: new Date() })
      .where(eq(quotes.id, id));
    await audit(
      tx,
      actor,
      id,
      "QUOTE_CONFIRMED",
      "Approved terms accepted; stock and billing created atomically",
      { revision, orderId: order!.id },
    );
    return order!;
  });
}
