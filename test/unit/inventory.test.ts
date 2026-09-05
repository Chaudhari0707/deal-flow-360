import { describe, expect, test } from "bun:test";

import { planFulfillment } from "@/features/inventory/planner";

const supply = [
  { available: 22, productId: "laptop", shippingWeight: 1, warehouseId: "main" },
  { available: 4, productId: "laptop", shippingWeight: 1.2, warehouseId: "east" },
  { available: 4, productId: "laptop", shippingWeight: 1.4, warehouseId: "west" },
];

describe("inventory split planner", () => {
  test("Acme uses 22 Main and 2 East at score 2.2", () => {
    expect(planFulfillment([{ productId: "laptop", quantity: 24 }], supply)).toEqual({
      allocations: [
        { productId: "laptop", quantity: 22, warehouseId: "main" },
        { productId: "laptop", quantity: 2, warehouseId: "east" },
      ],
      backorders: [],
      shipmentCount: 2,
      shippingScore: 2.2,
    });
  });
  test("Harbor maximizes fulfillment before minimizing shipments", () => {
    const plan = planFulfillment([{ productId: "laptop", quantity: 50 }], supply);
    expect(plan.allocations).toEqual([
      { productId: "laptop", quantity: 22, warehouseId: "main" },
      { productId: "laptop", quantity: 4, warehouseId: "east" },
      { productId: "laptop", quantity: 4, warehouseId: "west" },
    ]);
    expect(plan.backorders).toEqual([{ productId: "laptop", quantity: 20 }]);
    expect(plan.shippingScore).toBe(3.6);
  });
  test("minimizes shipments globally across products", () => {
    const plan = planFulfillment(
      [
        { productId: "a", quantity: 1 },
        { productId: "b", quantity: 1 },
      ],
      [
        { available: 10, productId: "a", shippingWeight: 1, warehouseId: "main" },
        { available: 10, productId: "b", shippingWeight: 1, warehouseId: "west" },
        { available: 1, productId: "a", shippingWeight: 2, warehouseId: "east" },
        { available: 1, productId: "b", shippingWeight: 2, warehouseId: "east" },
      ],
    );
    expect(plan.shipmentCount).toBe(1);
    expect(plan.allocations.every((a) => a.warehouseId === "east")).toBe(true);
  });
  test("duplicate demand lines and input ordering cannot change allocation", () => {
    expect(
      planFulfillment(
        [
          { productId: "laptop", quantity: 20 },
          { productId: "laptop", quantity: 4 },
        ],
        supply.toReversed(),
      ),
    ).toEqual(planFulfillment([{ productId: "laptop", quantity: 24 }], supply));
  });
  test("empty stock produces full unreserved backorder", () => {
    expect(planFulfillment([{ productId: "a", quantity: 8 }], []).backorders).toEqual([
      { productId: "a", quantity: 8 },
    ]);
    expect(planFulfillment([], supply).shipmentCount).toBe(0);
  });
  test("rejects corrupt quantities, duplicate balances and unbounded warehouse counts", () => {
    for (const quantity of [-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])
      expect(() => planFulfillment([{ productId: "a", quantity }], [])).toThrow();
    expect(() => planFulfillment([], [...supply, supply[0]!])).toThrow("Duplicate stock balance");
    expect(() =>
      planFulfillment([], [...supply, { ...supply[0]!, warehouseId: "fourth" }]),
    ).toThrow("at most three");
  });
});
