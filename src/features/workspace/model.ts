import { t } from "elysia";

import {
  actorModel,
  auditModel,
  creditModel,
  customerModel,
  deliveryModel,
  invoiceModel,
  messageModel,
  orderModel,
  paymentModel,
  productModel,
  quoteModel,
  reservationModel,
  settingModel,
  stockModel,
  subscriptionModel,
  warehouseModel,
} from "@/server/models";

export const meResponseModel = t.Object({ actor: actorModel });

export const workspaceResponseModel = t.Object({
  actor: actorModel,
  asOf: t.String({ format: "date-time" }),
  customers: t.Array(customerModel),
  products: t.Array(productModel),
  quotes: t.Array(quoteModel),
  warehouses: t.Array(warehouseModel),
  stocks: t.Array(stockModel),
  orders: t.Array(orderModel),
  subscriptions: t.Array(subscriptionModel),
  invoices: t.Array(invoiceModel),
  credits: t.Array(creditModel),
  payments: t.Array(paymentModel),
  reservations: t.Array(reservationModel),
  messages: t.Array(messageModel),
  settings: t.Array(settingModel),
  activity: t.Array(auditModel),
  deliveries: t.Array(deliveryModel),
});

export const workspaceModels = {
  MeResponse: meResponseModel,
  WorkspaceResponse: workspaceResponseModel,
} as const;
