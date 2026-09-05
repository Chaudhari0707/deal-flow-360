import type {
  InventoryAllocation,
  InventoryDemand,
  InventorySupply,
} from "@/features/inventory/_types/inventory";

/** Validate a replacement against free stock plus this order's own unshipped units. */
export function validateOverride(
  demand: InventoryDemand[],
  freeStock: InventorySupply[],
  currentUnshipped: InventoryAllocation[],
  proposed: InventoryAllocation[],
) {
  const available = new Map(
    freeStock.map((s) => [JSON.stringify([s.productId, s.warehouseId]), s.available]),
  );
  const needed = new Map(demand.map((d) => [d.productId, d.quantity]));
  for (const line of currentUnshipped) {
    const key = JSON.stringify([line.productId, line.warehouseId]);
    available.set(key, (available.get(key) ?? 0) + line.quantity);
  }
  const seen = new Set<string>();
  for (const line of proposed) {
    const key = JSON.stringify([line.productId, line.warehouseId]);
    if (seen.has(key)) throw new Error("A product/warehouse allocation must appear only once");
    seen.add(key);
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0)
      throw new Error("Allocation quantity must be a positive integer");
    if (!available.has(key) || line.quantity > (available.get(key) ?? 0))
      throw new Error("Allocation exceeds currently available stock");
    if (!needed.has(line.productId) || line.quantity > (needed.get(line.productId) ?? 0))
      throw new Error("Allocation exceeds remaining order demand");
    needed.set(line.productId, (needed.get(line.productId) ?? 0) - line.quantity);
  }
  return proposed;
}
