import { describe, expect, test } from "bun:test";

import { restockLocations } from "@/features/inventory/restock-locations";
import {
  ACTIVE_WAREHOUSE_LIMIT_MESSAGE,
  wouldExceedActiveWarehouseLimit,
} from "@/features/inventory/warehouse-limits";

const warehouses = [
  { active: true, id: "main" },
  { active: true, id: "east" },
  { active: true, id: "west" },
];

describe("warehouse and restock helpers", () => {
  test("activating a fourth warehouse is blocked; pausing one is not", () => {
    expect(wouldExceedActiveWarehouseLimit(warehouses, "", true)).toBe(true);
    expect(wouldExceedActiveWarehouseLimit(warehouses, "", false)).toBe(false);
    expect(wouldExceedActiveWarehouseLimit(warehouses, "west", true)).toBe(false);
    expect(
      wouldExceedActiveWarehouseLimit(
        [...warehouses, { active: false, id: "north" }],
        "north",
        true,
      ),
    ).toBe(true);
    expect(ACTIVE_WAREHOUSE_LIMIT_MESSAGE).toContain("three active warehouses");
  });

  test("sold-out balances remain restockable and report available as on hand minus reserved", () => {
    const locations = restockLocations(
      {
        products: [{ id: "laptop", name: "Laptop Pro 13", variant: "13 inch" }],
        stocks: [
          {
            id: "east-laptop",
            onHand: 4,
            productId: "laptop",
            reserved: 4,
            version: 1,
            warehouseId: "east",
          },
          {
            id: "main-laptop",
            onHand: 0,
            productId: "laptop",
            reserved: 0,
            version: 1,
            warehouseId: "main",
          },
        ],
        warehouses: [
          { id: "east", name: "East Depot", replenishmentThreshold: 5 },
          { id: "main", name: "Main", replenishmentThreshold: 5 },
          { id: "west", name: "West", replenishmentThreshold: 5 },
        ],
      },
      "laptop",
    );
    expect(
      locations.map((row) => [row.warehouse, row.onHand, row.reserved, row.available]),
    ).toEqual([
      ["East Depot", 4, 4, 0],
      ["Main", 0, 0, 0],
      ["West", 0, 0, 0],
    ]);
    expect(restockLocations({ products: [], stocks: [], warehouses: [] }, "laptop")).toEqual([]);
  });
});
