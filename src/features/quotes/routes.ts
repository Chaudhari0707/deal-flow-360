import { desc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { sendQuotation } from "@/features/quotes/email";
import {
  deliveryResultModel,
  quoteDetailModel,
  quoteInputModel,
  recommendationsModel,
} from "@/features/quotes/model";
import { purchaseRecommendations } from "@/features/quotes/recommendations";
import { approvalAction, saveQuote, submitQuote } from "@/features/quotes/service";
import { db } from "@/lib/db/connection";
import { auditEntries, messages, quotes } from "@/lib/db/schema";
import { permissions } from "@/lib/domain/permissions";
import { actorContext } from "@/server/access";
import { DomainError } from "@/server/errors";
import { apiErrorResponses, quoteModel } from "@/server/models";

const id = t.String({ minLength: 1, maxLength: 100 }),
  revision = t.Integer({ minimum: 1 });
const body = quoteInputModel;

export const quoteRoutes = new Elysia({ name: "quotes", tags: ["Quotes"] })
  .use(actorContext)
  .get(
    "/quotes/recommendations",
    async ({ query, set }) => {
      set.headers["cache-control"] = "private, no-store";
      return purchaseRecommendations(query.customerId);
    },
    {
      authorize: permissions.quoteWrite,
      query: t.Object({ customerId: id }),
      response: { 200: recommendationsModel, ...apiErrorResponses },
    },
  )
  .post("/quotes", async ({ actor, body: b }) => saveQuote(b, actor), {
    authorize: permissions.quoteWrite,
    body,
    response: { 200: quoteModel, ...apiErrorResponses },
  })
  .patch("/quotes/:id", async ({ actor, body: b, params }) => saveQuote(b, actor, params.id), {
    authorize: permissions.quoteWrite,
    body,
    params: t.Object({ id }),
    response: { 200: quoteModel, ...apiErrorResponses },
  })
  .get(
    "/quotes/:id",
    async ({ actor, params }) => {
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
    {
      authorize: permissions.quotations,
      params: t.Object({ id }),
      response: { 200: quoteDetailModel, ...apiErrorResponses },
    },
  )
  .post(
    "/quotes/:id/submit",
    async ({ actor, params, body: b }) => {
      const quote = await submitQuote(params.id, b.revision, actor);
      if (quote.status === "APPROVED") await sendQuotation(quote.id, actor);
      return quote;
    },
    {
      authorize: permissions.quoteWrite,
      params: t.Object({ id }),
      body: t.Object({ revision }),
      response: { 200: quoteModel, ...apiErrorResponses },
    },
  )
  .post(
    "/quotes/:id/approval",
    async ({ actor, params, body: b }) => {
      const quote = await approvalAction(params.id, b.revision, b.action, b.reason, actor);
      if (quote.status === "APPROVED") await sendQuotation(quote.id, actor);
      return quote;
    },
    {
      authorize: permissions.approvals,
      params: t.Object({ id }),
      body: t.Object({
        revision,
        action: t.Union([t.Literal("approve"), t.Literal("return"), t.Literal("reject")]),
        reason: t.String({ minLength: 3, maxLength: 1000 }),
      }),
      response: { 200: quoteModel, ...apiErrorResponses },
    },
  )
  .post(
    "/quotes/:id/send",
    async ({ actor, params, body: input }) => {
      const [quote] = await db.select().from(quotes).where(eq(quotes.id, params.id));
      if (!quote || (actor.role === "rep" && quote.ownerId !== actor.id))
        throw new DomainError("Quotation not found", 404);
      return sendQuotation(params.id, actor, input?.renew ?? false);
    },
    {
      authorize: permissions.quoteSend,
      params: t.Object({ id }),
      body: t.Optional(
        t.Object({ renew: t.Optional(t.Boolean()) }, { additionalProperties: false }),
      ),
      response: { 200: deliveryResultModel, ...apiErrorResponses },
    },
  );
