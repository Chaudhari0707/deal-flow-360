import type {
  fulfillmentDetail,
  fulfillmentList,
  inventorySnapshot,
} from "@/features/inventory/queries";
import type { Serialized } from "@/lib/domain/_types/workspace";

export type FulfillmentDetail = Serialized<Awaited<ReturnType<typeof fulfillmentDetail>>>;
export type FulfillmentList = Serialized<Awaited<ReturnType<typeof fulfillmentList>>>;
export type InventorySnapshot = Serialized<Awaited<ReturnType<typeof inventorySnapshot>>>;
export type StockRow = InventorySnapshot["stocks"][number];
export type WarehouseRow = InventorySnapshot["warehouses"][number];
