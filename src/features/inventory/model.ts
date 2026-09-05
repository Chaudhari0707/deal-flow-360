import { t } from "elysia";

import { orderModel, stockModel, stockMovementModel, warehouseModel } from "@/server/models";

export const inventorySnapshotModel = t.Object({
  warehouses: t.Array(warehouseModel),
  stocks: t.Array(
    t.Intersect([
      stockModel,
      t.Object({
        available: t.Integer(),
        name: t.String(),
        variant: t.String(),
        warehouse: t.String(),
        replenishmentThreshold: t.Integer(),
      }),
    ]),
  ),
  total: t.Integer(),
});

const allocationModel = t.Object({
  id: t.String(),
  productId: t.String(),
  warehouseId: t.String(),
  quantity: t.Integer(),
  shipped: t.Integer(),
  warehouse: t.String(),
  shippingWeight: t.Integer(),
  product: t.String(),
});

const demandModel = t.Object({ productId: t.String(), quantity: t.Integer() });

export const fulfillmentDetailModel = t.Object({
  order: orderModel,
  allocations: t.Array(allocationModel),
  backorders: t.Array(t.Intersect([demandModel, t.Object({ product: t.String() })])),
  movements: t.Array(stockMovementModel),
  shipmentCount: t.Integer(),
  shippingScore: t.Number(),
});

export const fulfillmentListModel = t.Object({
  items: t.Array(
    t.Object({
      id: t.String(),
      number: t.String(),
      customer: t.String(),
      fulfillmentStatus: t.String(),
      createdAt: t.Date(),
      promisedDate: t.Union([t.String(), t.Null()]),
    }),
  ),
  total: t.Integer(),
});

export const allocationPlanModel = t.Object({
  allocations: t.Array(
    t.Object({ productId: t.String(), quantity: t.Integer(), warehouseId: t.String() }),
  ),
  backorders: t.Array(demandModel),
  shipmentCount: t.Integer(),
  shippingScore: t.Number(),
  status: t.String(),
});

export const statusResponseModel = t.Object({ status: t.String() });
export const movementResponseModel = t.Object({
  movementId: t.String(),
  repeated: t.Boolean(),
});

export const inventoryModels = {
  FulfillmentDetail: fulfillmentDetailModel,
  FulfillmentList: fulfillmentListModel,
  FulfillmentPlan: allocationPlanModel,
  InventorySnapshot: inventorySnapshotModel,
  MovementResponse: movementResponseModel,
  StatusResponse: statusResponseModel,
} as const;
