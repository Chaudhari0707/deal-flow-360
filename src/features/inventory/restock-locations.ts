import type { StockRow } from "@/features/inventory/_types/ui";

export function restockLocations(
  workspace: {
    products: { id: string; name: string; variant: string }[];
    stocks: {
      id: string;
      onHand: number;
      productId: string;
      reserved: number;
      version: number;
      warehouseId: string;
    }[];
    warehouses: { id: string; name: string; replenishmentThreshold: number }[];
  },
  productId: string,
): StockRow[] {
  const product = workspace.products.find((row) => row.id === productId);
  return workspace.warehouses
    .map((warehouse) => {
      const balance = workspace.stocks.find(
        (row) => row.productId === productId && row.warehouseId === warehouse.id,
      );
      return {
        id: balance?.id ?? `${warehouse.id}:${productId}`,
        warehouseId: warehouse.id,
        productId,
        onHand: balance?.onHand ?? 0,
        reserved: balance?.reserved ?? 0,
        version: balance?.version ?? 0,
        available: (balance?.onHand ?? 0) - (balance?.reserved ?? 0),
        name: product?.name ?? productId,
        replenishmentThreshold: warehouse.replenishmentThreshold,
        variant: product?.variant ?? "",
        warehouse: warehouse.name,
      };
    })
    .toSorted((a, b) => a.warehouse.localeCompare(b.warehouse));
}
