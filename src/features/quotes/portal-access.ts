import { and, eq, gt, isNull } from "drizzle-orm";

import { tokenDigest } from "@/features/quotes/email";
import { db } from "@/lib/db/connection";
import { customers, profiles, quoteAccess, quotes, user } from "@/lib/db/schema";
import type { Actor } from "@/lib/domain/_types/domain";
import { requireActor } from "@/server/access";
import { DomainError } from "@/server/errors";

export function portalCookie(request: Request) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("dealflow_portal="))
    ?.slice("dealflow_portal=".length);
}

export async function redeemAccess(token: string) {
  const session = crypto.randomUUID() + crypto.randomUUID();
  const [access] = await db
    .update(quoteAccess)
    .set({
      redeemedAt: new Date(),
      sessionDigest: await tokenDigest(session),
      sessionExpiresAt: new Date(Date.now() + 8 * 3600000),
    })
    .where(
      and(
        eq(quoteAccess.digest, await tokenDigest(token)),
        eq(quoteAccess.revoked, false),
        isNull(quoteAccess.redeemedAt),
        gt(quoteAccess.expiresAt, new Date()),
      ),
    )
    .returning();
  if (!access)
    throw new DomainError(
      "This link expired or was already used. Ask your sales contact for a new link.",
      410,
    );
  return { session, quoteId: access.quoteId };
}

export async function portalIdentity(
  request: Request,
  quoteId?: string,
): Promise<{ actor: Actor; quoteId?: string }> {
  const token = portalCookie(request);
  if (token) {
    const [access] = await db
      .select()
      .from(quoteAccess)
      .where(
        and(
          eq(quoteAccess.sessionDigest, await tokenDigest(token)),
          eq(quoteAccess.revoked, false),
          gt(quoteAccess.sessionExpiresAt, new Date()),
        ),
      );
    if (access) {
      if (quoteId && quoteId !== access.quoteId) throw new DomainError("Quotation not found", 404);
      const [quote] = await db.select().from(quotes).where(eq(quotes.id, access.quoteId));
      const [customer] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, quote!.customerId));
      const [contact] = await db
        .select({ id: user.id })
        .from(profiles)
        .innerJoin(user, eq(user.id, profiles.userId))
        .where(and(eq(profiles.customerId, customer!.id), eq(profiles.role, "customer")))
        .limit(1);
      // Token contacts may not have a credential account; audit actor is nullable in that case.
      return {
        actor: {
          id: contact?.id ?? "",
          name: customer!.name,
          email: customer!.email,
          customerId: customer!.id,
          role: "customer",
        },
        quoteId: access.quoteId,
      };
    }
  }
  const actor = await requireActor(request);
  return { actor };
}

export async function permittedPortalQuote(request: Request, id: string) {
  const { actor } = await portalIdentity(request, id);
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, id));
  if (
    !quote ||
    (actor.role === "customer" && actor.customerId !== quote.customerId) ||
    (actor.role === "rep" && actor.id !== quote.ownerId) ||
    ["DRAFT", "RETURNED", "REJECTED"].includes(quote.status)
  )
    throw new DomainError("Quotation not found", 404);
  return { actor, quote };
}

export function publicQuote(quote: typeof quotes.$inferSelect) {
  return {
    id: quote.id,
    number: quote.number,
    customerId: quote.customerId,
    status: quote.status,
    revision: quote.revision,
    approvedRevision: quote.approvedRevision,
    lines: quote.lines.map(({ costCents: _cost, ...line }) => line),
    orderDiscountBps: quote.orderDiscountBps,
    subtotalCents: quote.subtotalCents,
    taxCents: quote.taxCents,
    totalCents: quote.totalCents,
    recurringCents: quote.recurringCents,
    promisedDate: quote.promisedDate,
    updatedAt: quote.updatedAt,
  };
}
