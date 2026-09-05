export type FulfillmentPlan = {
  allocations: InventoryAllocation[];
  backorders: InventoryDemand[];
  shipmentCount: number;
  shippingScore: number;
};

export type InventoryAllocation = InventoryDemand & { warehouseId: string };

export type InventoryDemand = { productId: string; quantity: number };

export type InventorySupply = {
  available: number;
  productId: string;
  shippingWeight: number;
  warehouseId: string;
};
