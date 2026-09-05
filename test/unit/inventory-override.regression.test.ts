import { describe, expect, test } from "bun:test";

import { validateOverride } from "@/features/inventory/override";
import {
  allocatedQuantity,
  clampOverrideQuantity,
  defaultOverrideRows,
  overrideAllocations,
  quantityMax,
  remainingForRow,
  rowQuantityError,
  rowWarehouseError,
  stockableProducts,
  warehouseAlreadyChosen,
  warehouseAvailable,
} from "@/features/inventory/override-form-state";

const demand = [{ productId: "laptop", quantity: 8 }];
const supply = [
  { available: 0, productId: "laptop", shippingWeight: 1.2, warehouseId: "east" },
  { available: 8, productId: "laptop", shippingWeight: 1, warehouseId: "main" },
];
const current = [{ productId: "laptop", quantity: 4, warehouseId: "east" }];
const stocks = [
  { onHand: 10, productId: "laptop", reserved: 10, warehouseId: "east" },
  { onHand: 8, productId: "laptop", reserved: 0, warehouseId: "main" },
];
const allocations = [{ productId: "laptop", quantity: 4, shipped: 0, warehouseId: "east" }];

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
  test("valid multi-warehouse fill stays within remaining demand and available stock", () => {
    const next = [
      { productId: "laptop", quantity: 4, warehouseId: "east" },
      { productId: "laptop", quantity: 4, warehouseId: "main" },
    ];
    expect(validateOverride(demand, supply, current, next)).toEqual(next);
  });
});

describe("override form warehouse selection", () => {
  test("available includes this order's unshipped reservation and is zero before a warehouse is chosen", () => {
    expect(warehouseAvailable("laptop", "", stocks, allocations)).toBe(0);
    expect(warehouseAvailable("laptop", "east", stocks, allocations)).toBe(4);
    expect(warehouseAvailable("laptop", "main", stocks, allocations)).toBe(8);
  });
  test("quantity cannot exceed selected-warehouse available stock or remaining line demand", () => {
    expect(rowQuantityError({ available: 4, quantity: 5, remaining: 8, warehouseId: "east" })).toBe(
      "Only this warehouse's available stock can be used.",
    );
    expect(rowQuantityError({ available: 8, quantity: 9, remaining: 8, warehouseId: "main" })).toBe(
      "This is more than the remaining line quantity.",
    );
    expect(
      rowQuantityError({ available: 10, quantity: 261, remaining: 32, warehouseId: "east" }),
    ).toBe("Only this warehouse's available stock can be used.");
    expect(
      rowQuantityError({ available: 4, quantity: 4, remaining: 4, warehouseId: "east" }),
    ).toBeUndefined();
    expect(
      rowQuantityError({ available: 4, quantity: 0, remaining: 8, warehouseId: "" }),
    ).toBeUndefined();
    expect(rowQuantityError({ available: 4, quantity: 2, remaining: 8, warehouseId: "" })).toBe(
      "Choose a warehouse first.",
    );
    expect(
      rowQuantityError({ available: 4, quantity: 1.5, remaining: 8, warehouseId: "east" }),
    ).toBe("Use a whole number (no decimals).");
  });
  test("the same warehouse cannot be chosen twice for one product", () => {
    const rows = [
      { productId: "laptop", warehouseId: "east" },
      { productId: "laptop", warehouseId: "east" },
      { productId: "mouse", warehouseId: "east" },
    ];
    expect(warehouseAlreadyChosen(rows, "laptop", "east", 0)).toBe(true);
    expect(warehouseAlreadyChosen(rows, "laptop", "main", 0)).toBe(false);
    expect(warehouseAlreadyChosen(rows, "mouse", "east", 2)).toBe(false);
    expect(rowWarehouseError({ quantity: 2, taken: true, warehouseId: "east" })).toBe(
      "This warehouse is already used for this product.",
    );
  });
  test("a valid multi-warehouse fill sums to line qty and omits empty or zero rows from the payload", () => {
    expect(quantityMax(4, 8)).toBe(4);
    expect(allocatedQuantity([{ quantity: 4 }, { quantity: 4 }, { quantity: 0 }])).toBe(8);
    expect(allocatedQuantity([{ quantity: "261" as unknown as number }])).toBe(261);
    expect(clampOverrideQuantity(261, 40)).toBe(40);
    expect(clampOverrideQuantity(24, 40)).toBe(24);
    expect(clampOverrideQuantity(Number.NaN, 40)).toBe(0);
    expect(
      remainingForRow(
        8,
        [
          { productId: "laptop", quantity: 4 },
          { productId: "mouse", quantity: 1 },
          { productId: "laptop", quantity: 3 },
        ],
        "laptop",
        2,
      ),
    ).toBe(4);
    expect(
      overrideAllocations([
        { productId: "laptop", quantity: 4, warehouseId: "east" },
        { productId: "laptop", quantity: 4, warehouseId: "main" },
        { productId: "laptop", quantity: 0, warehouseId: "west" },
        { productId: "laptop", quantity: 2, warehouseId: "" },
      ]),
    ).toEqual([
      { productId: "laptop", quantity: 4, warehouseId: "east" },
      { productId: "laptop", quantity: 4, warehouseId: "main" },
    ]);
  });
  test("default rows keep unshipped allocations, start an empty picker for backorder, and skip fully shipped lines", () => {
    expect(
      stockableProducts([
        { name: "Laptop", productId: "laptop", quantity: 3, stockable: true },
        { name: "Laptop", productId: "laptop", quantity: 5, stockable: true },
        { name: "Support", productId: "svc", quantity: 1, stockable: false },
      ]),
    ).toEqual([{ name: "Laptop", productId: "laptop", quantity: 8 }]);
    expect(
      defaultOverrideRows(
        [{ productId: "laptop", quantity: 8 }],
        [{ productId: "laptop", quantity: 8, shipped: 3, warehouseId: "east" }],
      ),
    ).toEqual([{ productId: "laptop", quantity: 5, warehouseId: "east" }]);
    expect(defaultOverrideRows([{ productId: "laptop", quantity: 8 }], [])).toEqual([
      { productId: "laptop", quantity: 0, warehouseId: "" },
    ]);
    expect(
      defaultOverrideRows(
        [{ productId: "laptop", quantity: 8 }],
        [{ productId: "laptop", quantity: 8, shipped: 8, warehouseId: "east" }],
      ),
    ).toEqual([]);
  });
});
