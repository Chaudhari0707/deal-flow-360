import { describe, expect, test } from "bun:test";

import { validateOverride } from "@/features/inventory/override";

const demand = [{ productId: "laptop", quantity: 8 }];
const supply = [
  { available: 0, productId: "laptop", shippingWeight: 1.2, warehouseId: "east" },
  { available: 8, productId: "laptop", shippingWeight: 1, warehouseId: "main" },
];
const current = [{ productId: "laptop", quantity: 4, warehouseId: "east" }];

describe("override reservation regressions", () => {
  test("original trap: own reservation remains reusable when public availability is zero", () => {
    expect(validateOverride(demand, supply, current, current)).toEqual(current);
  });
  test("another order's reservation cannot be stolen", () => {
    expect(() =>
      validateOverride(demand, supply, current, [
        { productId: "laptop", quantity: 6, warehouseId: "east" },
      ]),
    ).toThrow("available stock");
  });
  test("cannot allocate more than outstanding demand or duplicate a stock row", () => {
    expect(() =>
      validateOverride(demand, supply, current, [
        ...current,
        { productId: "laptop", quantity: 8, warehouseId: "main" },
      ]),
    ).toThrow("remaining order demand");
    expect(() => validateOverride(demand, supply, current, [...current, ...current])).toThrow(
      "only once",
    );
  });
  test("can atomically move its own units to another warehouse", () => {
    const next = [{ productId: "laptop", quantity: 8, warehouseId: "main" }];
    expect(validateOverride(demand, supply, current, next)).toEqual(next);
  });
});
