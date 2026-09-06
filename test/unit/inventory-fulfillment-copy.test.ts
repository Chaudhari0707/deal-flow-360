import { describe, expect, test } from "bun:test";

import {
  displayFulfillmentStatus,
  fulfillmentActions,
  NO_STOCK_AVAILABLE,
  remainingBackorderUnits,
  stillNeededLabel,
  stillNeededLine,
  warehouseAvailability,
} from "@/features/inventory/fulfillment-copy";

describe("fulfillment copy", () => {
  test("status labels do not mention an automated warehouse split", () => {
    expect(displayFulfillmentStatus("SPLIT_PENDING")).toBe("Awaiting accept");
    expect(displayFulfillmentStatus("READY")).toBe("Ready to ship");
    expect(displayFulfillmentStatus("BACKORDER")).toBe("Backorder");
    expect(displayFulfillmentStatus("FULFILLED")).toBe("Fulfilled");
  });

  test("backorder remaining is the units still needed to fulfill the order", () => {
    expect(remainingBackorderUnits([])).toBe(0);
    expect(remainingBackorderUnits([{ quantity: 26 }, { quantity: 4 }])).toBe(30);
    expect(stillNeededLabel(1)).toBe("1 unit still needed to fulfill this order");
    expect(stillNeededLabel(26)).toBe("26 units still needed to fulfill this order");
    expect(stillNeededLine("Laptop Pro 14", 26, 50)).toBe("Laptop Pro 14: 26 of 50 still needed");
  });

  test("warehouse availability lists only warehouses with stock to consolidate", () => {
    expect(
      warehouseAvailability(
        "laptop",
        [
          { active: true, id: "east", name: "East Depot" },
          { active: true, id: "main", name: "Main Warehouse" },
          { active: false, id: "west", name: "West" },
        ],
        [
          { onHand: 10, productId: "laptop", reserved: 10, warehouseId: "east" },
          { onHand: 8, productId: "laptop", reserved: 2, warehouseId: "main" },
          { onHand: 20, productId: "laptop", reserved: 0, warehouseId: "west" },
        ],
      ),
    ).toEqual([{ available: 6, name: "Main Warehouse", warehouseId: "main" }]);
    expect(
      warehouseAvailability(
        "laptop16",
        [
          { active: true, id: "east", name: "East Depot" },
          { active: true, id: "main", name: "Main Warehouse" },
          { active: true, id: "west", name: "West Hub" },
        ],
        [{ onHand: 12, productId: "laptop16", reserved: 12, warehouseId: "main" }],
      ),
    ).toEqual([]);
    expect(NO_STOCK_AVAILABLE).toBe("No stock available");
  });

  test("shipment actions follow reserved → accept → ship → fulfilled", () => {
    expect(
      fulfillmentActions({
        accepted: false,
        availableForBackorder: false,
        status: "SPLIT_PENDING",
        unshipped: true,
      }),
    ).toEqual({ accept: true, consolidate: false, override: false, ship: false });
    expect(
      fulfillmentActions({
        accepted: true,
        availableForBackorder: false,
        status: "READY",
        unshipped: true,
      }),
    ).toEqual({ accept: false, consolidate: false, override: true, ship: true });
    expect(
      fulfillmentActions({
        accepted: true,
        availableForBackorder: false,
        status: "FULFILLED",
        unshipped: false,
      }),
    ).toEqual({ accept: false, consolidate: false, override: false, ship: false });
    expect(
      fulfillmentActions({
        accepted: false,
        availableForBackorder: true,
        status: "BACKORDER",
        unshipped: true,
      }),
    ).toEqual({ accept: true, consolidate: true, override: true, ship: false });
  });
});
