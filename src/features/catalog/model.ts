import { t } from "elysia";

import { customerModel, deliveryStatusModel } from "@/server/models";

const id = t.String({ minLength: 1, maxLength: 100 });
const name = t.String({ minLength: 1, maxLength: 120 });
const cents = t.Integer({ minimum: 0, maximum: 10_000_000 });

export const catalogIdParamsModel = t.Object({ id });

export const customerInvitationModel = t.Object({
  id,
  status: deliveryStatusModel,
  message: t.Union([t.String(), t.Null()]),
});
export const customerCreatedModel = t.Intersect([
  customerModel,
  t.Object({ invitation: customerInvitationModel }),
]);

export const productBodyModel = t.Object(
  {
    name,
    category: t.Union([t.Literal("Hardware"), t.Literal("Services"), t.Literal("Subscription")]),
    priceCents: cents,
    costCents: cents,
    taxBps: t.Integer({ minimum: 0, maximum: 10_000 }),
    intervalMonths: t.Union([t.Literal(0), t.Literal(1), t.Literal(3), t.Literal(12)]),
    stockable: t.Boolean(),
    description: t.Optional(t.String({ maxLength: 2000 })),
    unit: t.Optional(name),
    variant: t.Optional(name),
    active: t.Optional(t.Boolean()),
    promoted: t.Optional(t.Boolean()),
    promotionBps: t.Optional(t.Integer({ minimum: 0, maximum: 10_000 })),
    pairedProductIds: t.Optional(t.Array(id, { maxItems: 5 })),
  },
  { additionalProperties: false },
);

export const customerBodyModel = t.Object(
  {
    name,
    email: t.String({ format: "email" }),
    tier: t.Union([t.Literal("Bronze"), t.Literal("Silver"), t.Literal("Gold")]),
    team: t.Optional(name),
  },
  { additionalProperties: false },
);

export const settingBodyModel = t.Object(
  { value: t.Record(t.String(), t.Number()) },
  { additionalProperties: false },
);

export const catalogModels = {
  CustomerInvitation: customerInvitationModel,
  CustomerCreated: customerCreatedModel,
  CatalogCustomerInput: customerBodyModel,
  CatalogProductInput: productBodyModel,
  CatalogSettingInput: settingBodyModel,
} as const;
