import { afterAll, describe, expect, test } from "bun:test";

import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { Elysia } from "elysia";
import postgres from "postgres";

import {
  acceptSplit,
  consolidateBackorder,
  overrideSplit,
  restock,
  shipReservation,
} from "@/features/inventory/mutations";
import { fulfillmentDetail } from "@/features/inventory/queries";
import { inventoryRoutes } from "@/features/inventory/routes";
import { reserveOrderStock } from "@/features/inventory/stock";
import { saveWarehouse } from "@/features/inventory/warehouse";
import { createAuth } from "@/lib/auth/create-auth";
import { db } from "@/lib/db/connection";
import * as schema from "@/lib/db/schema";
import type { Actor, QuoteLine } from "@/lib/domain/_types/domain";
import { DomainError } from "@/server/errors";

const connection = postgres(Bun.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
const parallelDb = drizzle(connection, { schema });
const fixtureIds: string[] = [];
const authIds: string[] = [];
afterAll(async () => {
  const productIds = fixtureIds.map((id) => `product-${id}`);
  const locationIds = fixtureIds.flatMap((id) =>
    [0, 1, 2, 3].map((index) => `warehouse-${index}-${id}`),
  );
  const userIds = [...fixtureIds, ...authIds];
  if (fixtureIds.length)
    await db.transaction(async (tx) => {
      await tx
        .delete(schema.stockMovements)
        .where(inArray(schema.stockMovements.productId, productIds));
      await tx
        .delete(schema.reservations)
        .where(inArray(schema.reservations.productId, productIds));
      await tx.delete(schema.stocks).where(inArray(schema.stocks.productId, productIds));
      await tx.delete(schema.orders).where(inArray(schema.orders.customerId, fixtureIds));
      await tx.delete(schema.quotes).where(inArray(schema.quotes.customerId, fixtureIds));
      await tx.delete(schema.customers).where(inArray(schema.customers.id, fixtureIds));
      await tx.delete(schema.products).where(inArray(schema.products.id, productIds));
      await tx.delete(schema.warehouses).where(inArray(schema.warehouses.id, locationIds));
      await tx.delete(schema.auditEntries).where(inArray(schema.auditEntries.actorId, userIds));
      await tx.delete(schema.user).where(inArray(schema.user.id, userIds));
    });
  await connection.end();
});

async function fixture(quantity = 24, available = [22, 4, 4]) {
  const id = crypto.randomUUID();
  fixtureIds.push(id);
  const actor: Actor = {
    customerId: null,
    email: `${id}@example.com`,
    id,
    name: "Inventory Operator",
    role: "ops",
  };
  const productId = `product-${id}`;
  const line: QuoteLine = {
    category: "Hardware",
    costCents: 700,
    discountBps: 0,
    id: `line-${id}`,
    intervalMonths: 0,
    name: "Laptop",
    netCents: quantity * 1000,
    priceCents: 1000,
    productId,
    quantity,
    stockable: true,
    taxBps: 0,
    taxCents: 0,
    totalCents: quantity * 1000,
    variant: "Standard",
  };
  await db.insert(schema.user).values({
    id,
    name: actor.name,
    email: actor.email,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(schema.customers).values({ id, name: "Inventory customer", email: actor.email });
  await db.insert(schema.products).values({
    id: productId,
    name: "Laptop",
    category: "Hardware",
    costCents: 700,
    priceCents: 1000,
    stockable: true,
  });
  const warehouses = available.map((_, i) => ({
    id: `warehouse-${i}-${id}`,
    name: ["Main", "East", "West"][i]!,
    shippingWeight: 100 + i * 20,
  }));
  await db.insert(schema.warehouses).values(warehouses);
  await db.insert(schema.stocks).values(
    warehouses.map((w, i) => ({
      id: `stock-${i}-${id}`,
      warehouseId: w.id,
      productId,
      onHand: available[i]!,
      reserved: 0,
    })),
  );
  async function newOrder(suffix: string, qty = quantity) {
    const orderId = `${id}-${suffix}`;
    const lines = [{ ...line, quantity: qty }];
    await db.insert(schema.quotes).values({
      id: orderId,
      number: `Q-${orderId}`,
      customerId: id,
      ownerId: id,
      lines,
      status: "CONFIRMED",
    });
    const [order] = await db
      .insert(schema.orders)
      .values({ id: orderId, number: `SO-${orderId}`, quoteId: orderId, customerId: id, lines })
      .returning();
    return order!;
  }
  return { actor, newOrder, order: await newOrder("first"), productId, warehouses };
}

async function balances(productId: string) {
  return db
    .select()
    .from(schema.stocks)
    .where(eq(schema.stocks.productId, productId))
    .orderBy(schema.stocks.id);
}

describe("inventory transaction regressions", () => {
  test("confirmation reserves 22/2; Accept retries never reserve twice", async () => {
    const f = await fixture();
    await db.transaction((tx) => reserveOrderStock(tx, f.order, f.actor));
    expect((await balances(f.productId)).map((s) => s.reserved)).toEqual([22, 2, 0]);
    await Promise.all([acceptSplit(f.order.id, f.actor), acceptSplit(f.order.id, f.actor)]);
    expect((await balances(f.productId)).map((s) => s.reserved)).toEqual([22, 2, 0]);
    expect((await fulfillmentDetail(f.order.id)).order.fulfillmentStatus).toBe("READY");
  });

  test("two independent PostgreSQL connections cannot over-reserve the same stock", async () => {
    const f = await fixture(24);
    const other = await f.newOrder("competing");
    let release!: () => void;
    const started = new Promise<void>((resolve) => {
      release = resolve;
    });
    await Promise.all([
      db.transaction(async (tx) => {
        await started;
        await reserveOrderStock(tx, f.order, f.actor);
      }),
      parallelDb.transaction(async (tx) => {
        release();
        await reserveOrderStock(tx, other, f.actor);
      }),
    ]);
    const stock = await balances(f.productId);
    expect(stock.map((s) => s.reserved)).toEqual([22, 4, 4]);
    const all = await db
      .select()
      .from(schema.reservations)
      .where(eq(schema.reservations.productId, f.productId));
    expect(all.reduce((sum, r) => sum + r.quantity, 0)).toBe(30);
    expect(stock.every((s) => s.onHand >= s.reserved)).toBe(true);
  });

  test("Northwind restock/consolidation preserves another order and shipment retries", async () => {
    const f = await fixture(8, [0, 6, 0]);
    const other = await f.newOrder("other", 2);
    await db.transaction((tx) => reserveOrderStock(tx, other, f.actor));
    await db.transaction((tx) => reserveOrderStock(tx, f.order, f.actor));
    const before = await fulfillmentDetail(f.order.id);
    expect(before.backorders[0]?.quantity).toBe(4);
    const receipt = {
      operationKey: crypto.randomUUID(),
      productId: f.productId,
      quantity: 8,
      reason: "Restock Northwind",
      warehouseId: f.warehouses[1]!.id,
    };
    await Promise.all([restock(receipt, f.actor), restock(receipt, f.actor)]);
    await Promise.all([
      consolidateBackorder(f.order.id, f.actor),
      consolidateBackorder(f.order.id, f.actor),
    ]);
    const [east] = (await balances(f.productId)).filter(
      (s) => s.warehouseId === f.warehouses[1]!.id,
    );
    expect([east!.onHand, east!.reserved, east!.onHand - east!.reserved]).toEqual([14, 10, 4]);
    expect((await fulfillmentDetail(other.id)).allocations[0]?.quantity).toBe(2);
    await acceptSplit(f.order.id, f.actor);
    const detail = await fulfillmentDetail(f.order.id);
    const shipment = {
      operationKey: crypto.randomUUID(),
      quantity: 8,
      reservationId: detail.allocations[0]!.id,
    };
    const [first, retry] = await Promise.all([
      shipReservation(f.order.id, shipment, f.actor),
      shipReservation(f.order.id, shipment, f.actor),
    ]);
    expect([first, retry].map((row) => Object.keys(row).toSorted())).toEqual([
      ["movementId", "repeated"],
      ["movementId", "repeated"],
    ]);
    expect(
      (await balances(f.productId)).find((s) => s.warehouseId === f.warehouses[1]!.id)?.reserved,
    ).toBe(2);
    expect((await fulfillmentDetail(f.order.id)).order.fulfillmentStatus).toBe("FULFILLED");
  });

  test("sold-out restock increases available and does not auto-consolidate", async () => {
    const f = await fixture(5, [0, 0, 0]);
    await db.transaction((tx) => reserveOrderStock(tx, f.order, f.actor));
    expect((await fulfillmentDetail(f.order.id)).backorders[0]?.quantity).toBe(5);
    const receipt = {
      operationKey: crypto.randomUUID(),
      productId: f.productId,
      quantity: 5,
      reason: "Sold-out receipt",
      warehouseId: f.warehouses[0]!.id,
    };
    await restock(receipt, f.actor);
    const [main] = await balances(f.productId);
    expect([main!.onHand, main!.reserved, main!.onHand - main!.reserved]).toEqual([5, 0, 5]);
    expect((await fulfillmentDetail(f.order.id)).backorders[0]?.quantity).toBe(5);
    await consolidateBackorder(f.order.id, f.actor);
    expect((await fulfillmentDetail(f.order.id)).backorders).toEqual([]);
    expect((await balances(f.productId))[0]?.reserved).toBe(5);
  });

  test("restock creates a balance when the product is new at that warehouse", async () => {
    const f = await fixture(1, [1, 0, 0]);
    const west = f.warehouses[2]!;
    await db.delete(schema.stocks).where(eq(schema.stocks.warehouseId, west.id));
    const receipt = {
      operationKey: crypto.randomUUID(),
      productId: f.productId,
      quantity: 4,
      reason: "First receipt at West",
      warehouseId: west.id,
    };
    await restock(receipt, f.actor);
    expect((await balances(f.productId)).find((s) => s.warehouseId === west.id)?.onHand).toBe(4);
  });

  test("consolidate fills remaining demand from warehouses that have available stock", async () => {
    const f = await fixture(10, [0, 0, 0]);
    await db.transaction((tx) => reserveOrderStock(tx, f.order, f.actor));
    expect((await fulfillmentDetail(f.order.id)).backorders[0]?.quantity).toBe(10);
    await expect(consolidateBackorder(f.order.id, f.actor)).rejects.toThrow(
      "No available stock at active warehouses",
    );
    await restock(
      {
        operationKey: crypto.randomUUID(),
        productId: f.productId,
        quantity: 6,
        reason: "Partial receipt at East",
        warehouseId: f.warehouses[1]!.id,
      },
      f.actor,
    );
    const plan = await consolidateBackorder(f.order.id, f.actor);
    expect(plan.allocations).toEqual([
      { productId: f.productId, quantity: 6, warehouseId: f.warehouses[1]!.id },
    ]);
    expect(plan.backorders).toEqual([{ productId: f.productId, quantity: 4 }]);
    const east = (await balances(f.productId)).find(
      (row) => row.warehouseId === f.warehouses[1]!.id,
    );
    expect([east!.onHand, east!.reserved]).toEqual([6, 6]);
  });

  test("fourth active warehouse is blocked until one is paused", async () => {
    const f = await fixture();
    const snapshot = await db.select().from(schema.warehouses);
    const values = {
      id: `warehouse-3-${f.actor.id}`,
      name: `North-${f.actor.id}`,
      replenishmentThreshold: 5,
      shippingWeight: 160,
    };
    async function restore() {
      for (const warehouse of snapshot)
        await db
          .update(schema.warehouses)
          .set({ active: warehouse.active })
          .where(eq(schema.warehouses.id, warehouse.id));
    }
    try {
      await db.update(schema.warehouses).set({ active: false });
      const activeThree = snapshot.filter((warehouse) => warehouse.active).slice(0, 3);
      expect(activeThree).toHaveLength(3);
      for (const warehouse of activeThree)
        await db
          .update(schema.warehouses)
          .set({ active: true })
          .where(eq(schema.warehouses.id, warehouse.id));
      await expect(saveWarehouse(undefined, { ...values, active: true }, f.actor)).rejects.toThrow(
        "Pause an existing warehouse first. The demo planner supports three active warehouses.",
      );
      const paused = await saveWarehouse(undefined, { ...values, active: false }, f.actor);
      await expect(saveWarehouse(paused.id, { ...paused, active: true }, f.actor)).rejects.toThrow(
        "Pause an existing warehouse first",
      );
      await saveWarehouse(activeThree[2]!.id, { ...activeThree[2]!, active: false }, f.actor);
      expect((await saveWarehouse(paused.id, { ...paused, active: true }, f.actor)).active).toBe(
        true,
      );
    } finally {
      await restore();
    }
  });

  test("failed override rolls back all ledger changes and shipped units never move", async () => {
    const f = await fixture(8, [8, 8, 0]);
    await db.transaction((tx) => reserveOrderStock(tx, f.order, f.actor));
    await expect(
      overrideSplit(
        f.order.id,
        [{ productId: f.productId, quantity: 8, warehouseId: f.warehouses[1]!.id }],
        "Too early",
        f.actor,
      ),
    ).rejects.toThrow("Accept the shipment before changing reservations");
    await acceptSplit(f.order.id, f.actor);
    const snapshot = await balances(f.productId);
    await expect(
      overrideSplit(
        f.order.id,
        [{ productId: f.productId, quantity: 9, warehouseId: f.warehouses[1]!.id }],
        "Invalid request",
        f.actor,
      ),
    ).rejects.toThrow();
    expect(await balances(f.productId)).toEqual(snapshot);
    await overrideSplit(
      f.order.id,
      [{ productId: f.productId, quantity: 8, warehouseId: f.warehouses[1]!.id }],
      "Customer delivery preference",
      f.actor,
    );
    const afterMove = await fulfillmentDetail(f.order.id);
    expect(afterMove.allocations.map((a) => a.warehouseId)).toEqual([f.warehouses[1]!.id]);
    const allocation = afterMove.allocations[0]!;
    await shipReservation(
      f.order.id,
      { operationKey: crypto.randomUUID(), quantity: 3, reservationId: allocation.id },
      f.actor,
    );
    await overrideSplit(
      f.order.id,
      [{ productId: f.productId, quantity: 5, warehouseId: f.warehouses[0]!.id }],
      "Move remaining units",
      f.actor,
    );
    const moved = await fulfillmentDetail(f.order.id);
    expect(moved.allocations.find((a) => a.warehouseId === f.warehouses[1]!.id)?.shipped).toBe(3);
    expect(moved.backorders).toEqual([]);
  });

  test("PostgreSQL rejects reservation above on hand and rolls back", async () => {
    const f = await fixture(1, [1, 0, 0]);
    await expect(
      db.transaction((tx) =>
        tx
          .update(schema.stocks)
          .set({ reserved: 2 })
          .where(
            and(
              eq(schema.stocks.productId, f.productId),
              eq(schema.stocks.warehouseId, f.warehouses[0]!.id),
            ),
          ),
      ),
    ).rejects.toThrow();
    expect((await balances(f.productId))[0]?.reserved).toBe(0);
    await expect(
      db.transaction(async (tx) => {
        await reserveOrderStock(tx, f.order, f.actor);
        await tx.execute(sql`select 1/0`);
      }),
    ).rejects.toThrow();
    expect((await balances(f.productId))[0]?.reserved).toBe(0);
  });

  test("real HTTP routes reject anonymous users and malformed quantities", async () => {
    const api = new Elysia({ normalize: false })
      .onError(({ code, error, set }) => {
        if (code === "VALIDATION" || code === "PARSE") {
          set.status = 400;
          return { error: "Check request fields" };
        }
        if (error instanceof DomainError) {
          set.status = error.status;
          return { error: error.message };
        }
      })
      .use(inventoryRoutes);
    const anonymous = await api.handle(new Request("http://localhost/inventory"));
    expect(anonymous.status).toBe(401);
    const f = await fixture();
    const auth = createAuth(db);
    const password = `Test-${crypto.randomUUID()}`;
    const email = `auth-${crypto.randomUUID()}@example.com`;
    const signup = await auth.api.signUpEmail({
      body: { email, password, name: "Inventory HTTP User" },
    });
    authIds.push(signup.user.id);
    await db.insert(schema.profiles).values({ userId: signup.user.id, role: "rep" });
    const login = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
    const cookie = login.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const denied = await api.handle(
      new Request("http://localhost/inventory/restock", {
        method: "POST",
        headers: {
          cookie,
          origin: new URL(Bun.env.BETTER_AUTH_URL!).origin,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          operationKey: crypto.randomUUID(),
          productId: f.productId,
          quantity: 1,
          reason: "Permission test",
          warehouseId: f.warehouses[0]!.id,
        }),
      }),
    );
    expect(denied.status).toBe(403);
    const malformed = await api.handle(
      new Request("http://localhost/inventory/restock", {
        method: "POST",
        headers: {
          cookie,
          origin: new URL(Bun.env.BETTER_AUTH_URL!).origin,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ quantity: -1 }),
      }),
    );
    expect(malformed.status).toBe(400);
    await db
      .update(schema.profiles)
      .set({ role: "admin" })
      .where(eq(schema.profiles.userId, signup.user.id));
    const receipt = {
      operationKey: crypto.randomUUID(),
      productId: f.productId,
      quantity: 3,
      reason: "Authorized receipt",
      warehouseId: f.warehouses[0]!.id,
    };
    const request = (payload: unknown) =>
      new Request("http://localhost/inventory/restock", {
        method: "POST",
        headers: {
          cookie,
          origin: new URL(Bun.env.BETTER_AUTH_URL!).origin,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    for (const origin of [undefined, "null", "https://untrusted.example"]) {
      const forged = request(receipt);
      if (origin === undefined) forged.headers.delete("origin");
      else forged.headers.set("origin", origin);
      expect((await api.handle(forged)).status).toBe(403);
    }
    expect((await balances(f.productId))[0]?.onHand).toBe(22);
    const configuredUrl = Bun.env.BETTER_AUTH_URL;
    try {
      Bun.env.BETTER_AUTH_URL = `${new URL(configuredUrl!).origin}/`;
      expect((await api.handle(request(receipt))).status).toBe(200);
    } finally {
      Bun.env.BETTER_AUTH_URL = configuredUrl;
    }
    expect((await api.handle(request(receipt))).status).toBe(200);
    expect((await balances(f.productId))[0]?.onHand).toBe(25);
    expect((await api.handle(request({ ...receipt, quantity: 4 }))).status).toBe(409);
    expect((await api.handle(request({ ...receipt, hiddenOverride: true }))).status).toBe(400);
  });
});
