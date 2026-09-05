import { and, desc, eq, inArray } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { tokenDigest } from "@/features/quotes/email";
import {
  permittedPortalQuote,
  portalCookie,
  portalIdentity,
  publicQuote,
  redeemAccess,
} from "@/features/quotes/portal-access";
import { confirmQuote, counterQuote } from "@/features/quotes/service";
import { db } from "@/lib/db/connection";
import { customers, messages, quoteAccess, quotes } from "@/lib/db/schema";
import { requireMutationOrigin } from "@/server/access";
import { DomainError } from "@/server/errors";

const id = t.String({ minLength: 1, maxLength: 100 }),
  params = t.Object({ id }),
  revision = t.Integer({ minimum: 1 });

export const portalRoutes = new Elysia({ name: "portal" })
  .onBeforeHandle(({ request }) => requireMutationOrigin(request))
  .post(
    "/portal/redeem",
    async ({ body, set }) => {
      const result = await redeemAccess(body.token);
      set.headers["set-cookie"] =
        `dealflow_portal=${result.session}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${Bun.env.BETTER_AUTH_URL?.startsWith("https:") ? "; Secure" : ""}`;
      return { quoteId: result.quoteId };
    },
    { body: t.Object({ token: t.String({ minLength: 32, maxLength: 200 }) }) },
  )
  .post("/portal/logout", async ({ request, set }) => {
    const token = portalCookie(request);
    if (token)
      await db
        .update(quoteAccess)
        .set({ revoked: true })
        .where(eq(quoteAccess.sessionDigest, await tokenDigest(token)));
    set.headers["set-cookie"] = "dealflow_portal=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";
    return { ok: true };
  })
  .get("/portal", async ({ request, set }) => {
    const identity = await portalIdentity(request);
    set.headers["cache-control"] = "private, no-store";
    const visible = await db
      .select()
      .from(quotes)
      .where(
        and(
          inArray(quotes.status, [
            "APPROVED",
            "SENT",
            "UNDER_NEGOTIATION",
            "PENDING_APPROVAL",
            "CONFIRMED",
          ]),
          identity.quoteId
            ? eq(quotes.id, identity.quoteId)
            : eq(quotes.customerId, identity.actor.customerId ?? ""),
        ),
      )
      .orderBy(desc(quotes.createdAt), desc(quotes.id))
      .limit(100);
    const [customer] = identity.actor.customerId
      ? await db.select().from(customers).where(eq(customers.id, identity.actor.customerId))
      : [];
    return { actor: identity.actor, customer: customer ?? null, quotes: visible.map(publicQuote) };
  })
  .get(
    "/portal/:id",
    async ({ request, params: p, set }) => {
      const { quote, actor } = await permittedPortalQuote(request, p.id);
      set.headers["cache-control"] = "private, no-store";
      const [customer] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, quote.customerId));
      const thread = await db
        .select()
        .from(messages)
        .where(eq(messages.quoteId, quote.id))
        .orderBy(messages.createdAt, messages.id)
        .limit(200);
      return { quote: publicQuote(quote), customer, actor, messages: thread };
    },
    { params },
  )
  .post(
    "/portal/:id/message",
    async ({ request, params: p, body }) => {
      const { actor, quote } = await permittedPortalQuote(request, p.id);
      if (!body.body.trim()) throw new DomainError("Write a message before sending");
      if (body.lineId && !quote.lines.some((l) => l.id === body.lineId))
        throw new DomainError("Unknown line");
      const [message] = await db
        .insert(messages)
        .values({
          id: crypto.randomUUID(),
          quoteId: p.id,
          lineId: body.lineId,
          authorId: actor.id || null,
          authorName: actor.name,
          body: body.body.trim(),
        })
        .returning();
      await db
        .update(quotes)
        .set({
          updatedAt: new Date(),
          status: quote.status === "SENT" ? "UNDER_NEGOTIATION" : quote.status,
        })
        .where(
          and(
            eq(quotes.id, quote.id),
            eq(quotes.revision, quote.revision),
            eq(quotes.status, quote.status),
          ),
        );
      return message;
    },
    {
      params,
      body: t.Object({ body: t.String({ minLength: 1, maxLength: 2000 }), lineId: t.Optional(id) }),
    },
  )
  .post(
    "/portal/:id/counter",
    async ({ request, params: p, body }) => {
      const { actor } = await permittedPortalQuote(request, p.id);
      return publicQuote(
        await counterQuote(p.id, body.revision, body.lines, actor, body.promisedDate),
      );
    },
    {
      params,
      body: t.Object({
        revision,
        lines: t.Array(t.Object({ id, discountBps: t.Integer({ minimum: 0, maximum: 10000 }) }), {
          maxItems: 100,
        }),
        promisedDate: t.Optional(t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" })),
      }),
    },
  )
  .post(
    "/portal/:id/confirm",
    async ({ request, params: p, body }) => {
      const { actor } = await permittedPortalQuote(request, p.id);
      const order = await confirmQuote(p.id, body.revision, actor);
      return { id: order.id, number: order.number, fulfillmentStatus: order.fulfillmentStatus };
    },
    { params, body: t.Object({ revision }) },
  );
