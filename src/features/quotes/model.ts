import { t, type TSchema } from "elysia";

import {
  actorModel,
  auditModel,
  customerModel,
  messageModel,
  quoteLineModel,
  quoteModel,
  quoteStatusModel,
} from "@/server/models";

const nullable = <Schema extends TSchema>(schema: Schema) => t.Union([schema, t.Null()]);

export const quoteIdModel = t.String({ minLength: 1, maxLength: 100 });
export const quoteRevisionModel = t.Integer({ minimum: 1 });

export const quoteInputModel = t.Object(
  {
    customerId: quoteIdModel,
    lines: t.Array(
      t.Object({
        id: t.Optional(quoteIdModel),
        productId: quoteIdModel,
        quantity: t.Integer({ minimum: 1, maximum: 10000 }),
        discountBps: t.Integer({ minimum: 0, maximum: 10000 }),
        upsell: t.Optional(t.Boolean()),
      }),
      { minItems: 1, maxItems: 100 },
    ),
    orderDiscountBps: t.Integer({ minimum: 0, maximum: 10000 }),
    notes: t.Optional(t.String({ maxLength: 2000 })),
    promisedDate: t.Optional(t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" })),
    revision: t.Optional(quoteRevisionModel),
  },
  { additionalProperties: false },
);

export const quoteDetailModel = t.Object({
  quote: quoteModel,
  activity: t.Array(auditModel),
  messages: t.Array(messageModel),
});

export const recommendationsModel = t.Object({
  source: t.Union([t.Literal("last_purchase"), t.Literal("best_sellers")]),
  productIds: t.Array(t.String(), { maxItems: 5 }),
});

export const deliveryResultModel = t.Object({
  status: t.Union([t.Literal("SENT"), t.Literal("FAILED")]),
  deliveryId: t.String(),
  message: t.Optional(nullable(t.String())),
});

export const publicQuoteLineModel = t.Omit(quoteLineModel, ["costCents"]);
export const publicQuoteModel = t.Object({
  id: t.String(),
  number: t.String(),
  customerId: t.String(),
  status: quoteStatusModel,
  revision: t.Integer(),
  approvedRevision: nullable(t.Integer()),
  lines: t.Array(publicQuoteLineModel),
  orderDiscountBps: t.Integer(),
  subtotalCents: t.Integer(),
  taxCents: t.Integer(),
  totalCents: t.Integer(),
  recurringCents: t.Integer(),
  promisedDate: nullable(t.String()),
  updatedAt: t.Date(),
});

export const portalWorkspaceModel = t.Object({
  actor: actorModel,
  customer: nullable(customerModel),
  quotes: t.Array(publicQuoteModel),
});

export const portalDetailModel = t.Object({
  actor: actorModel,
  customer: customerModel,
  messages: t.Array(messageModel),
  quote: publicQuoteModel,
});

export const quoteModels = {
  DeliveryResult: deliveryResultModel,
  PortalDetail: portalDetailModel,
  PortalWorkspace: portalWorkspaceModel,
  PublicQuote: publicQuoteModel,
  PurchaseRecommendations: recommendationsModel,
  QuoteDetail: quoteDetailModel,
  QuoteInput: quoteInputModel,
} as const;
