export function fulfillmentSplitEmptyMessage(lines: { stockable: boolean }[]): string {
  return lines.some((line) => line.stockable)
    ? "No stock allocation yet. Receive stock, then consolidate the backorder."
    : "No stockable lines";
}
