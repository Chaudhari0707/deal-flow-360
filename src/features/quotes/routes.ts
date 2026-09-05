import { desc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { sendQuotation } from "@/features/quotes/email";
import { purchaseRecommendations } from "@/features/quotes/recommendations";
import { approvalAction, saveQuote, submitQuote } from "@/features/quotes/service";
import { db } from "@/lib/db/connection";
import { auditEntries, messages, quotes } from "@/lib/db/schema";
import { requireActor } from "@/server/access";
import { DomainError } from "@/server/errors";

const id = t.String({ minLength: 1, maxLength: 100 }),
  revision = t.Integer({ minimum: 1 });
const body = t.Object(
  {
    customerId: id,
    lines: t.Array(
      t.Object({
        id: t.Optional(id),
        productId: id,
        quantity: t.Integer({ minimum: 1, maximum: 10000 }),
        discountBps: t.Integer({ minimum: 0, maximum: 10000 }),
        upsell: t.Optional(t.Boolean()),
      }),
      { minItems: 1, maxItems: 100 },
    ),
    orderDiscountBps: t.Integer({ minimum: 0, maximum: 10000 }),
    notes: t.Optional(t.String({ maxLength: 2000 })),
    promisedDate: t.Optional(t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" })),
    revision: t.Optional(revision),
  },
  { additionalProperties: false },
);

export const quoteRoutes = new Elysia({ name: "quotes" })
  .get(
    "/quotes/recommendations",
    async ({ query, request, set }) => {
      await requireActor(request, ["rep", "manager", "admin"]);
      set.headers["cache-control"] = "private, no-store";
      return purchaseRecommendations(query.customerId);
    },
    { query: t.Object({ customerId: id }) },
  )
  .post(
    "/quotes",
    async ({ body: b, request }) => saveQuote(b, await requireActor(request, ["rep"])),
    { body },
  )
  .patch(
    "/quotes/:id",
    async ({ body: b, params, request }) =>
      saveQuote(b, await requireActor(request, ["rep"]), params.id),
    { body, params: t.Object({ id }) },
  )
  .get(
    "/quotes/:id",
    async ({ params, request }) => {
      const actor = await requireActor(request, ["rep", "manager", "finance", "ops"]);
      const [quote] = await db.select().from(quotes).where(eq(quotes.id, params.id));
      if (!quote || (actor.role === "rep" && quote.ownerId !== actor.id))
        throw new DomainError("Quotation not found", 404);
      const [activity, thread] = await Promise.all([
        db
          .select()
          .from(auditEntries)
          .where(eq(auditEntries.entityId, quote.id))
          .orderBy(desc(auditEntries.createdAt), desc(auditEntries.id))
          .limit(100),
        db
          .select()
          .from(messages)
          .where(eq(messages.quoteId, quote.id))
          .orderBy(desc(messages.createdAt), desc(messages.id))
          .limit(100),
      ]);
      return { quote, activity, messages: thread };
    },
    { params: t.Object({ id }) },
  )
  .post(
    "/quotes/:id/submit",
    async ({ params, body: b, request }) => {
      const actor = await requireActor(request, ["rep"]);
      const quote = await submitQuote(params.id, b.revision, actor);
      if (quote.status === "APPROVED") await sendQuotation(quote.id, actor);
      return quote;
    },
    { params: t.Object({ id }), body: t.Object({ revision }) },
  )
  .post(
    "/quotes/:id/approval",
    async ({ params, body: b, request }) => {
      const actor = await requireActor(request, ["manager", "finance"]);
      const quote = await approvalAction(params.id, b.revision, b.action, b.reason, actor);
      if (quote.status === "APPROVED") await sendQuotation(quote.id, actor);
      return quote;
    },
    {
      params: t.Object({ id }),
      body: t.Object({
        revision,
        action: t.Union([t.Literal("approve"), t.Literal("return"), t.Literal("reject")]),
        reason: t.String({ minLength: 3, maxLength: 1000 }),
      }),
    },
  )
  .post(
    "/quotes/:id/send",
    async ({ params, request, body: input }) => {
      const actor = await requireActor(request, ["rep", "manager", "finance"]);
      const [quote] = await db.select().from(quotes).where(eq(quotes.id, params.id));
      if (!quote || (actor.role === "rep" && quote.ownerId !== actor.id))
        throw new DomainError("Quotation not found", 404);
      return sendQuotation(params.id, actor, input?.renew ?? false);
    },
    {
      params: t.Object({ id }),
      body: t.Optional(
        t.Object({ renew: t.Optional(t.Boolean()) }, { additionalProperties: false }),
      ),
    },
  );
