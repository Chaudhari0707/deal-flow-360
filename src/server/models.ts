import { t, type TSchema } from "elysia";

const nullable = <Schema extends TSchema>(schema: Schema) => t.Union([schema, t.Null()]);

export const roleModel = t.Union([
  t.Literal("admin"),
  t.Literal("customer"),
  t.Literal("finance"),
  t.Literal("manager"),
  t.Literal("ops"),
  t.Literal("rep"),
]);

export const actorModel = t.Object({
  customerId: nullable(t.String()),
  email: t.String({ format: "email" }),
  id: t.String(),
  name: t.String(),
  role: roleModel,
});

export const errorModel = t.Object({ error: t.String() });

export const customerModel = t.Object({
  id: t.String(),
  name: t.String(),
  email: t.String({ format: "email" }),
  tier: t.String(),
  team: t.String(),
});

export const productModel = t.Object({
  id: t.String(),
  name: t.String(),
  category: t.String(),
  description: t.String(),
  unit: t.String(),
  priceCents: t.Integer(),
  costCents: t.Integer(),
  taxBps: t.Integer(),
  stockable: t.Boolean(),
  intervalMonths: t.Integer(),
  variant: t.String(),
  active: t.Boolean(),
  promoted: t.Boolean(),
  promotionBps: t.Integer(),
  pairedProductIds: t.Array(t.String()),
});

export const quoteLineModel = t.Object({
  category: t.String(),
  costCents: t.Integer(),
  discountBps: t.Integer(),
  id: t.String(),
  intervalMonths: t.Integer(),
  name: t.String(),
  netCents: t.Integer(),
  priceCents: t.Integer(),
  productId: t.String(),
  quantity: t.Integer(),
  stockable: t.Boolean(),
  taxBps: t.Integer(),
  taxCents: t.Integer(),
  totalCents: t.Integer(),
  upsell: t.Optional(t.Boolean()),
  variant: t.String(),
});

export const riskSnapshotModel = t.Object({
  lines: t.Array(
    t.Object({
      ceilingBps: t.Integer(),
      effectiveBps: t.Integer(),
      name: t.String(),
      overBps: t.Integer(),
    }),
  ),
  maxOverBps: t.Integer(),
  risk: t.Union([t.Literal("NONE"), t.Literal("MEDIUM"), t.Literal("HIGH")]),
  sumOverBps: t.Integer(),
});

export const quoteModel = t.Object({
  id: t.String(),
  number: t.String(),
  customerId: t.String(),
  ownerId: t.String(),
  status: t.String(),
  revision: t.Integer(),
  approvedRevision: nullable(t.Integer()),
  approvalStep: nullable(t.String()),
  lines: t.Array(quoteLineModel),
  orderDiscountBps: t.Integer(),
  risk: t.String(),
  riskSnapshot: nullable(riskSnapshotModel),
  subtotalCents: t.Integer(),
  taxCents: t.Integer(),
  totalCents: t.Integer(),
  marginCents: t.Integer(),
  recurringCents: t.Integer(),
  promisedDate: nullable(t.String()),
  notes: t.String(),
  createdAt: t.Date(),
  updatedAt: t.Date(),
});

export const orderModel = t.Object({
  id: t.String(),
  quoteId: t.String(),
  number: t.String(),
  customerId: t.String(),
  lines: t.Array(quoteLineModel),
  fulfillmentStatus: t.String(),
  acceptedAt: nullable(t.Date()),
  promisedDate: nullable(t.String()),
  createdAt: t.Date(),
});

export const auditModel = t.Object({
  id: t.String(),
  entityId: t.String(),
  actorId: nullable(t.String()),
  actorName: t.String(),
  action: t.String(),
  reason: t.String(),
  revision: nullable(t.Integer()),
  detail: nullable(t.Unknown()),
  createdAt: t.Date(),
});

export const messageModel = t.Object({
  id: t.String(),
  quoteId: t.String(),
  lineId: nullable(t.String()),
  authorId: nullable(t.String()),
  authorName: t.String(),
  body: t.String(),
  createdAt: t.Date(),
});

export const settingModel = t.Object({
  id: t.String(),
  value: t.Record(t.String(), t.Number()),
});

export const warehouseModel = t.Object({
  id: t.String(),
  name: t.String(),
  shippingWeight: t.Integer(),
  active: t.Boolean(),
  replenishmentThreshold: t.Integer(),
});

export const stockModel = t.Object({
  id: t.String(),
  warehouseId: t.String(),
  productId: t.String(),
  onHand: t.Integer(),
  reserved: t.Integer(),
  version: t.Integer(),
});

export const reservationModel = t.Object({
  id: t.String(),
  orderId: t.String(),
  productId: t.String(),
  warehouseId: t.String(),
  quantity: t.Integer(),
  shipped: t.Integer(),
});

export const stockMovementModel = t.Object({
  id: t.String(),
  operationKey: t.String(),
  warehouseId: t.String(),
  productId: t.String(),
  orderId: nullable(t.String()),
  actorId: t.String(),
  quantity: t.Integer(),
  kind: t.String(),
  reason: t.String(),
  createdAt: t.Date(),
});

export const subscriptionModel = t.Object({
  id: t.String(),
  orderId: t.String(),
  customerId: t.String(),
  productId: t.String(),
  name: t.String(),
  quantity: t.Integer(),
  priceCents: t.Integer(),
  periodNetCents: t.Integer(),
  priceBasisCents: t.Integer(),
  priceBasisQuantity: t.Integer(),
  taxBps: t.Integer(),
  intervalMonths: t.Integer(),
  anchorDay: t.Integer(),
  periodStart: t.String(),
  periodEnd: t.String(),
  status: t.String(),
  version: t.Integer(),
  createdAt: t.Date(),
});

export const invoiceModel = t.Object({
  id: t.String(),
  number: t.String(),
  operationKey: t.String(),
  orderId: t.String(),
  customerId: t.String(),
  subscriptionId: nullable(t.String()),
  kind: t.String(),
  lines: t.Array(quoteLineModel),
  subtotalCents: t.Integer(),
  taxCents: t.Integer(),
  totalCents: t.Integer(),
  paidCents: t.Integer(),
  creditedCents: t.Integer(),
  status: t.String(),
  dueDate: t.String(),
  periodStart: nullable(t.String()),
  periodEnd: nullable(t.String()),
  createdAt: t.Date(),
});

export const paymentModel = t.Object({
  id: t.String(),
  invoiceId: t.String(),
  operationKey: t.String(),
  amountCents: t.Integer(),
  reference: t.String(),
  actorId: t.String(),
  createdAt: t.Date(),
});

export const creditModel = t.Object({
  id: t.String(),
  number: t.String(),
  invoiceId: t.String(),
  customerId: t.String(),
  subscriptionId: nullable(t.String()),
  operationKey: t.String(),
  amountCents: t.Integer(),
  appliedCents: t.Integer(),
  reason: t.String(),
  createdAt: t.Date(),
});

export const deliveryModel = t.Object({
  id: t.String(),
  quoteId: t.String(),
  revision: t.Integer(),
  status: t.String(),
  providerId: nullable(t.String()),
  error: nullable(t.String()),
  attempts: t.Integer(),
  createdAt: t.Date(),
});

export const apiModels = {
  Actor: actorModel,
  ApiError: errorModel,
  AuditEntry: auditModel,
  Credit: creditModel,
  Customer: customerModel,
  Delivery: deliveryModel,
  Invoice: invoiceModel,
  Message: messageModel,
  Order: orderModel,
  Payment: paymentModel,
  Product: productModel,
  Quote: quoteModel,
  QuoteLine: quoteLineModel,
  Reservation: reservationModel,
  Setting: settingModel,
  Stock: stockModel,
  StockMovement: stockMovementModel,
  Subscription: subscriptionModel,
  Warehouse: warehouseModel,
} as const;

export const apiErrorResponses = {
  400: errorModel,
  401: errorModel,
  403: errorModel,
  404: errorModel,
  409: errorModel,
  410: errorModel,
  429: errorModel,
  500: errorModel,
  503: errorModel,
} as const;

const openApiErrorResponse = {
  description: "Error response",
  content: {
    "application/json": { schema: { $ref: "#/components/schemas/ApiError" } },
  },
} as const;

export const openApiErrorResponses = {
  400: openApiErrorResponse,
  401: openApiErrorResponse,
  403: openApiErrorResponse,
  404: openApiErrorResponse,
  409: openApiErrorResponse,
  410: openApiErrorResponse,
  429: openApiErrorResponse,
  500: openApiErrorResponse,
  503: openApiErrorResponse,
} as const;
