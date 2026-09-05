import type { Static } from "elysia";

import type {
  allocationPlanModel,
  fulfillmentDetailModel,
  fulfillmentListModel,
  inventorySnapshotModel,
} from "@/features/inventory/model";
import type { JsonTransport } from "@/lib/api/_types/client";

export type FulfillmentDetail = JsonTransport<Static<typeof fulfillmentDetailModel>>;
export type FulfillmentList = JsonTransport<Static<typeof fulfillmentListModel>>;
export type FulfillmentPlan = JsonTransport<Static<typeof allocationPlanModel>>;
export type InventorySnapshot = JsonTransport<Static<typeof inventorySnapshotModel>>;
export type StockRow = InventorySnapshot["stocks"][number];
export type WarehouseRow = InventorySnapshot["warehouses"][number];
