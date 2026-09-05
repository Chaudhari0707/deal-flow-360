type Allocation = {
  productId: string;
  quantity: number;
  shipped: number;
  warehouseId: string;
};
type OverrideRow = { productId: string; quantity: number; warehouseId: string };
type StockBalance = {
  onHand: number;
  productId: string;
  reserved: number;
  warehouseId: string;
};

export function allocatedQuantity(rows: { quantity: number }[]) {
  return rows.reduce((sum, row) => {
    const quantity = Number(row.quantity);
    return sum + (Number.isSafeInteger(quantity) && quantity > 0 ? quantity : 0);
  }, 0);
}

/** Seed one row per unshipped allocation, or an empty picker when demand remains. */
export function defaultOverrideRows(
  products: { productId: string; quantity: number }[],
  allocations: Allocation[],
) {
  const rows: OverrideRow[] = [];
  for (const product of products) {
    const existing = allocations.filter(
      (line) => line.productId === product.productId && line.quantity > line.shipped,
    );
    const shipped = allocations
      .filter((line) => line.productId === product.productId)
      .reduce((sum, line) => sum + line.shipped, 0);
    if (existing.length > 0)
      for (const line of existing)
        rows.push({
          productId: product.productId,
          quantity: line.quantity - line.shipped,
          warehouseId: line.warehouseId,
        });
    else if (product.quantity > shipped)
      rows.push({ productId: product.productId, quantity: 0, warehouseId: "" });
  }
  return rows;
}

export function overrideAllocations(rows: OverrideRow[]) {
  return rows
    .filter((row) => row.warehouseId && Number.isSafeInteger(row.quantity) && row.quantity > 0)
    .map((row) => ({
      productId: row.productId,
      quantity: row.quantity,
      warehouseId: row.warehouseId,
    }));
}

export function quantityMax(available: number, remaining: number) {
  return Math.max(0, Math.min(available, remaining));
}

export function clampOverrideQuantity(quantity: number, max: number) {
  if (!Number.isSafeInteger(quantity) || quantity < 0) return 0;
  return Math.min(quantity, max);
}

export function remainingForRow(
  unshippedDemand: number,
  rows: { productId: string; quantity: number }[],
  productId: string,
  index: number,
) {
  return (
    unshippedDemand -
    allocatedQuantity(
      rows.filter((row, rowIndex) => row.productId === productId && rowIndex !== index),
    )
  );
}

export function rowQuantityError(input: {
  available: number;
  quantity: number;
  remaining: number;
  warehouseId: string;
}) {
  const { available, quantity, remaining, warehouseId } = input;
  if (!warehouseId) {
    if (!Number.isFinite(quantity) || quantity === 0) return;
    return "Choose a warehouse first.";
  }
  const max = quantityMax(available, remaining);
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    if (available <= 0) return "This warehouse has no available stock.";
    if (remaining <= 0) return "Nothing left to allocate on this line.";
    if (!Number.isFinite(quantity)) return "Enter a quantity.";
    if (!Number.isInteger(quantity)) return "Use a whole number (no decimals).";
    return `Enter a quantity from 1 to ${max.toLocaleString("en-US")}.`;
  }
  if (quantity > available && available < remaining)
    return "Only this warehouse's available stock can be used.";
  if (quantity > remaining) return "This is more than the remaining line quantity.";
  if (quantity > available) return "Only this warehouse's available stock can be used.";
}

export function rowWarehouseError(input: {
  quantity: number;
  taken: boolean;
  warehouseId: string;
}) {
  if (!input.warehouseId) {
    if (!Number.isFinite(input.quantity) || input.quantity === 0) return;
    return "Choose a warehouse first.";
  }
  if (input.taken) return "This warehouse is already used for this product.";
}

export function stockableProducts(
  lines: { name: string; productId: string; quantity: number; stockable: boolean }[],
) {
  const products = new Map<string, { name: string; productId: string; quantity: number }>();
  for (const line of lines) {
    if (!line.stockable) continue;
    const current = products.get(line.productId);
    products.set(line.productId, {
      name: line.name,
      productId: line.productId,
      quantity: (current?.quantity ?? 0) + line.quantity,
    });
  }
  return [...products.values()];
}

export function warehouseAlreadyChosen(
  rows: { productId: string; warehouseId: string }[],
  productId: string,
  warehouseId: string,
  index: number,
) {
  if (!warehouseId) return false;
  return rows.some(
    (row, rowIndex) =>
      rowIndex !== index && row.productId === productId && row.warehouseId === warehouseId,
  );
}

/** Public free stock plus this order's unshipped reservation at the warehouse. */
export function warehouseAvailable(
  productId: string,
  warehouseId: string,
  stocks: StockBalance[],
  allocations: Allocation[],
) {
  if (!warehouseId) return 0;
  const balance = stocks.find(
    (stock) => stock.productId === productId && stock.warehouseId === warehouseId,
  );
  const unshipped = allocations
    .filter((line) => line.productId === productId && line.warehouseId === warehouseId)
    .reduce((sum, line) => sum + Math.max(0, line.quantity - line.shipped), 0);
  return (balance ? balance.onHand - balance.reserved : 0) + unshipped;
}
