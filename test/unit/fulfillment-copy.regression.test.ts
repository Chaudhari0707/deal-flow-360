import { describe, expect, test } from "bun:test";

import {
  fulfillmentAcceptanceCopy,
  fulfillmentSplitEmptyMessage,
} from "@/features/inventory/fulfillment-copy";

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

  test("service-only fulfilled orders do not wait on a warehouse split", () => {
    expect(
      fulfillmentAcceptanceCopy({
        acceptedAt: null,
        lines: [{ stockable: false }],
      }),
    ).toBe("Services only — no warehouse dispatch required");
  });

  test("hardware still reports accept versus pending split", () => {
    expect(fulfillmentAcceptanceCopy({ acceptedAt: null, lines: [{ stockable: true }] })).toBe(
      "Awaiting operations acceptance",
    );
    expect(
      fulfillmentAcceptanceCopy({
        acceptedAt: "2026-08-29T00:00:00.000Z",
        lines: [{ stockable: true }],
      }),
    ).toBe("Split accepted by operations");
  });
});
