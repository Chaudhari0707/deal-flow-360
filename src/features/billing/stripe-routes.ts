import { Elysia, t } from "elysia";

import {
  createInvoiceCheckoutSession,
  fulfillCheckoutSession,
  listCustomerInvoices,
} from "@/features/billing/stripe-checkout";
import { stripeClient, stripeWebhookSecret } from "@/features/billing/stripe-client";
import { actorContext } from "@/server/access";
import { apiErrorResponses } from "@/server/models";

const id = t.Object({ id: t.String({ minLength: 1, maxLength: 100 }) });

const portalInvoiceModel = t.Object({
  createdAt: t.String({ format: "date-time" }),
  dueDate: t.String(),
  id: t.String(),
  kind: t.String(),
  number: t.String(),
  outstandingCents: t.Integer(),
  paidCents: t.Integer(),
  status: t.String(),
  totalCents: t.Integer(),
});

const checkoutSessionModel = t.Object({
  clientSecret: t.String(),
  publishableKey: t.String(),
  sessionId: t.String(),
});

export const stripeRoutes = new Elysia({ name: "stripe", tags: ["Billing"] })
  .use(actorContext)
  .get(
    "/portal/billing/invoices",
    async ({ actor }) => ({ invoices: await listCustomerInvoices(actor) }),
    {
      authorize: ["customer"],
      response: {
        200: t.Object({ invoices: t.Array(portalInvoiceModel) }),
        ...apiErrorResponses,
      },
    },
  )
  .post(
    "/portal/billing/invoices/:id/checkout",
    async ({ actor, params }) => createInvoiceCheckoutSession(actor, params.id),
    {
      authorize: ["customer"],
      params: id,
      response: { 200: checkoutSessionModel, ...apiErrorResponses },
    },
  )
  .post(
    "/stripe/webhook",
    async ({ body, request, set }) => {
      const signature = request.headers.get("stripe-signature");
      if (!signature) {
        set.status = 400;
        return { error: "Missing Stripe signature" };
      }
      if (typeof body !== "string") {
        set.status = 400;
        return { error: "Webhook body must be raw text" };
      }
      let event;
      try {
        event = await stripeClient().webhooks.constructEventAsync(
          body,
          signature,
          stripeWebhookSecret(),
        );
      } catch {
        set.status = 400;
        return { error: "Webhook signature verification failed" };
      }
      if (event.type === "checkout.session.completed") {
        await fulfillCheckoutSession(event.data.object);
      }
      return { received: true as const };
    },
    {
      detail: {
        description: "Stripe webhook receiver. Verifies signature on the raw body.",
        security: [],
      },
      parse: "text",
      response: {
        200: t.Object({ received: t.Literal(true) }),
        ...apiErrorResponses,
      },
    },
  );
