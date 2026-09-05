export function displayFulfillmentStatus(status: string) {
  if (status === "SPLIT_PENDING") return "Awaiting accept";
  if (status === "READY") return "Ready to ship";
  if (status === "BACKORDER") return "Backorder";
  if (status === "FULFILLED") return "Fulfilled";
  return status.replaceAll("_", " ");
}

/** Confirm reserves stock. Then: accept → ship → fulfilled. Backorder needs Inventory restock first. */
export function fulfillmentActions(input: {
  accepted: boolean;
  availableForBackorder: boolean;
  status: string;
  unshipped: boolean;
}) {
  const fulfilled = input.status === "FULFILLED";
  const reserved = input.status === "SPLIT_PENDING";
  const backorder = input.status === "BACKORDER";
  return {
    accept: !fulfilled && !input.accepted,
    consolidate: !fulfilled && backorder && input.availableForBackorder,
    override: !fulfilled && !reserved && input.unshipped,
    ship: !fulfilled && input.accepted && input.unshipped,
  };
}

export function fulfillmentNextStep(
  status: string,
  actions: ReturnType<typeof fulfillmentActions>,
) {
  if (status === "FULFILLED")
    return "Fulfilled: every reserved unit was shipped. Status does not change again.";
  if (status === "SPLIT_PENDING")
    return "Awaiting accept: stock is held. Click Accept shipment to move this to Ready to ship.";
  if (status === "READY")
    return "Ready to ship: you already accepted. Click Ship on each warehouse line to fulfill.";
  if (actions.consolidate && actions.accept)
    return "Backorder: restock on Inventory, click Consolidate remaining backorder, then Accept shipment.";
  if (actions.consolidate)
    return "Backorder: restock on Inventory, then click Consolidate remaining backorder.";
  if (actions.accept) return "Click Accept shipment, then Ship.";
  if (actions.ship) return "Click Ship on each warehouse line to fulfill.";
  return "";
}

export function remainingBackorderUnits(backorders: { quantity: number }[]) {
  return backorders.reduce((sum, line) => sum + line.quantity, 0);
}

export function stillNeededLabel(units: number) {
  return units === 1
    ? "1 unit still needed to fulfill this order"
    : `${units} units still needed to fulfill this order`;
}

export function stillNeededLine(product: string, remaining: number, ordered: number) {
  return `${product}: ${remaining} of ${ordered} still needed`;
}

export const NO_STOCK_AVAILABLE = "No stock available";

export function warehouseAvailability(
  productId: string,
  warehouses: { active: boolean; id: string; name: string }[],
  stocks: { onHand: number; productId: string; reserved: number; warehouseId: string }[],
) {
  return warehouses
    .filter((warehouse) => warehouse.active)
    .map((warehouse) => {
      const stock = stocks.find(
        (row) => row.productId === productId && row.warehouseId === warehouse.id,
      );
      return {
        available: stock ? Math.max(0, stock.onHand - stock.reserved) : 0,
        name: warehouse.name,
        warehouseId: warehouse.id,
      };
    })
    .filter((location) => location.available > 0)
    .toSorted((a, b) => b.available - a.available || a.name.localeCompare(b.name));
}
