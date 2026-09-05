import { describe, expect, test } from "bun:test";

import { fulfillmentSplitEmptyMessage } from "@/features/inventory/fulfillment-copy";
import { fulfillmentDetail } from "@/features/inventory/queries";
import { stockDemand } from "@/features/inventory/stock";
import { db } from "@/lib/db/connection";
import { orders } from "@/lib/db/schema/commerce";
import { reservations, stocks } from "@/lib/db/schema/inventory";
import { seedDemo } from "@/lib/db/seed/demo";
import {
  BACKORDER_QUOTE_IDS,
  FULFILLED_HARDWARE_ORDER_ID,
  fulfilledHardwareShipments,
} from "@/lib/db/seed/demo-fulfillment";

describe("demo fulfillment seed", () => {
  test("seeded FULFILLED hardware has shipment facts and a consistent ledger", async () => {
    const url = new URL(Bun.env.DATABASE_URL!);
    if (!url.pathname.endsWith("_test"))
      throw new Error("Demo fulfillment seed tests require a dedicated _test database");
    await seedDemo(db);
    await seedDemo(db);

    const hardware = await fulfillmentDetail(FULFILLED_HARDWARE_ORDER_ID);
    expect(hardware.order.fulfillmentStatus).toBe("FULFILLED");
    expect(hardware.order.acceptedAt).toBeTruthy();
    expect(hardware.allocations).toHaveLength(fulfilledHardwareShipments.length);
    expect(hardware.allocations.every((row) => row.shipped === row.quantity)).toBe(true);
    expect(hardware.movements.filter((row) => row.kind === "SHIP")).toHaveLength(
      fulfilledHardwareShipments.length,
    );
    expect(hardware.movements.map((row) => row.product).sort()).toEqual(
      ["Docking Station", "Wireless Mouse"].sort(),
    );

    const harbor = await fulfillmentDetail("order-Q-1024");
    const northwind = await fulfillmentDetail("order-Q-1022");
    expect(harbor.order.fulfillmentStatus).toBe("BACKORDER");
    expect(northwind.order.fulfillmentStatus).toBe("BACKORDER");
    expect(BACKORDER_QUOTE_IDS.has("Q-1024")).toBe(true);

    const orion = await fulfillmentDetail("order-Q-1026");
    expect(orion.order.fulfillmentStatus).toBe("FULFILLED");
    expect(orion.allocations).toEqual([]);
    expect(fulfillmentSplitEmptyMessage(orion.order.lines)).toBe("No stockable lines");

    const fulfilled = await db.select().from(orders);
    for (const order of fulfilled.filter(
      (row) => row.fulfillmentStatus === "FULFILLED" && row.id.startsWith("order-Q-"),
    )) {
      const demand = stockDemand(order.lines);
      const detail = await fulfillmentDetail(order.id);
      if (demand.length === 0) {
        expect(detail.allocations).toEqual([]);
        expect(detail.movements).toEqual([]);
        continue;
      }
      expect(detail.order.acceptedAt).toBeTruthy();
      expect(detail.allocations.length).toBeGreaterThan(0);
      expect(detail.allocations.every((row) => row.shipped === row.quantity)).toBe(true);
      expect(detail.movements.some((row) => row.kind === "SHIP")).toBe(true);
    }

    const [balances, holds] = await Promise.all([
      db.select().from(stocks),
      db.select().from(reservations),
    ]);
    for (const balance of balances) {
      const unshipped = holds
        .filter(
          (row) => row.productId === balance.productId && row.warehouseId === balance.warehouseId,
        )
        .reduce((sum, row) => sum + (row.quantity - row.shipped), 0);
      expect(balance.reserved).toBe(unshipped);
      expect(balance.onHand).toBeGreaterThanOrEqual(balance.reserved);
    }
  }, 60_000);
});
