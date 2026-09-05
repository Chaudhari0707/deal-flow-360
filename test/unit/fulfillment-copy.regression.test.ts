import { describe, expect, test } from "bun:test";

import { fulfillmentSplitEmptyMessage } from "@/features/inventory/fulfillment-copy";

describe("fulfillment split empty copy", () => {
  test("hardware without allocations still asks for stock", () => {
    expect(fulfillmentSplitEmptyMessage([{ stockable: true }, { stockable: false }])).toBe(
      "No stock allocation yet. Receive stock, then consolidate the backorder.",
    );
  });

  test("service-only orders do not look like a missing split", () => {
    expect(fulfillmentSplitEmptyMessage([{ stockable: false }, { stockable: false }])).toBe(
      "No stockable lines",
    );
  });
});
