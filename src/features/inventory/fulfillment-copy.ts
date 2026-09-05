export function hasStockableLines(lines: { stockable: boolean }[]): boolean {
  return lines.some((line) => line.stockable);
}

export function fulfillmentSplitEmptyMessage(lines: { stockable: boolean }[]): string {
  return hasStockableLines(lines)
    ? "No stock allocation yet. Receive stock, then consolidate the backorder."
    : "No stockable lines";
}

export function fulfillmentAcceptanceCopy(order: {
  acceptedAt: Date | string | null;
  lines: { stockable: boolean }[];
}): string {
  if (!hasStockableLines(order.lines)) return "Services only — no warehouse dispatch required";
  return order.acceptedAt ? "Split accepted by operations" : "Awaiting operations acceptance";
}
