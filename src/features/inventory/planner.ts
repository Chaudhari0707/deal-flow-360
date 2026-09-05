import type {
  FulfillmentPlan,
  InventoryDemand,
  InventorySupply,
} from "@/features/inventory/_types/inventory";

function integer(value: number) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error("Quantity must be a nonnegative safe integer");
}

/** Exact minimum-shipment planner for the explicitly bounded three-warehouse demo. */
export function planFulfillment(
  demand: InventoryDemand[],
  supply: InventorySupply[],
): FulfillmentPlan {
  const quantities = new Map<string, number>();
  for (const line of demand) {
    integer(line.quantity);
    const quantity = (quantities.get(line.productId) ?? 0) + line.quantity;
    integer(quantity);
    quantities.set(line.productId, quantity);
  }
  const warehouses = new Map<string, number>();
  const seen = new Set<string>();
  for (const stock of supply) {
    integer(stock.available);
    if (!Number.isFinite(stock.shippingWeight) || stock.shippingWeight < 0)
      throw new Error("Invalid shipping weight");
    const key = JSON.stringify([stock.warehouseId, stock.productId]);
    if (seen.has(key)) throw new Error("Duplicate stock balance");
    seen.add(key);
    if (
      warehouses.has(stock.warehouseId) &&
      warehouses.get(stock.warehouseId) !== stock.shippingWeight
    )
      throw new Error("Inconsistent warehouse weight");
    warehouses.set(stock.warehouseId, stock.shippingWeight);
  }
  const ids = [...warehouses.keys()].sort();
  if (ids.length > 3) throw new Error("The exact demo planner supports at most three warehouses");
  const products = [...quantities.keys()].sort();
  const target = new Map(
    products.map((productId) => [
      productId,
      Math.min(
        quantities.get(productId) ?? 0,
        supply.filter((s) => s.productId === productId).reduce((sum, s) => sum + s.available, 0),
      ),
    ]),
  );
  let best: FulfillmentPlan | undefined;
  let bestKey = "";
  for (let mask = 0; mask < 2 ** ids.length; mask++) {
    const selected = new Set(ids.filter((_, index) => (mask & (1 << index)) !== 0));
    if (
      products.some(
        (productId) =>
          supply
            .filter((s) => s.productId === productId && selected.has(s.warehouseId))
            .reduce((sum, s) => sum + s.available, 0) < (target.get(productId) ?? 0),
      )
    )
      continue;
    const allocations: FulfillmentPlan["allocations"] = [];
    for (const productId of products) {
      let remaining = target.get(productId) ?? 0;
      const options = supply
        .filter((s) => s.productId === productId && selected.has(s.warehouseId))
        .toSorted(
          (a, b) => b.available - a.available || a.warehouseId.localeCompare(b.warehouseId),
        );
      for (const stock of options) {
        const quantity = Math.min(remaining, stock.available);
        if (quantity > 0) allocations.push({ productId, quantity, warehouseId: stock.warehouseId });
        remaining -= quantity;
      }
    }
    const used = [...new Set(allocations.map((a) => a.warehouseId))].sort();
    const shippingScore =
      Math.round(used.reduce((sum, id) => sum + (warehouses.get(id) ?? 0), 0) * 1000) / 1000;
    const key = used.join("\u0000");
    if (
      !best ||
      used.length < best.shipmentCount ||
      (used.length === best.shipmentCount &&
        (shippingScore < best.shippingScore ||
          (shippingScore === best.shippingScore && key < bestKey)))
    ) {
      best = {
        allocations,
        backorders: products
          .map((productId) => ({
            productId,
            quantity: (quantities.get(productId) ?? 0) - (target.get(productId) ?? 0),
          }))
          .filter((line) => line.quantity > 0),
        shipmentCount: used.length,
        shippingScore,
      };
      bestKey = key;
    }
  }
  return best ?? { allocations: [], backorders: [], shipmentCount: 0, shippingScore: 0 };
}
