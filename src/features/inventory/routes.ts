import { eq, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import {
  acceptSplit,
  consolidateBackorder,
  overrideSplit,
  restock,
  shipReservation,
} from "@/features/inventory/mutations";
import {
  fulfillmentDetail,
  fulfillmentList,
  inventorySnapshot,
} from "@/features/inventory/queries";
import { saveWarehouse } from "@/features/inventory/warehouse";
import { db } from "@/lib/db/connection";
import { products } from "@/lib/db/schema/commerce";
import { stocks, warehouses } from "@/lib/db/schema/inventory";
import { requireActor } from "@/server/access";
import { audit } from "@/server/audit";
import { DomainError } from "@/server/errors";

const id = t.String({ minLength: 1, maxLength: 100 });
const positive = t.Integer({ minimum: 1, maximum: 1_000_000 });
const params = t.Object({ id });
const paging = t.Object({
  page: t.Optional(t.Numeric({ minimum: 0, maximum: 100000, multipleOf: 1 })),
  pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
});
const reason = t.String({ minLength: 3, maxLength: 500 });

const warehouseBody = t.Object(
  {
    active: t.Boolean(),
    name: t.String({ minLength: 1, maxLength: 100 }),
    replenishmentThreshold: t.Integer({ minimum: 0, maximum: 1_000_000 }),
    shippingWeight: t.Integer({ minimum: 0, maximum: 100_000 }),
  },
  { additionalProperties: false },
);

export const inventoryRoutes = new Elysia({ name: "inventory", normalize: false })
  .get(
    "/inventory",
    async ({ request, query }) => {
      await requireActor(request, ["admin", "ops", "manager", "rep"]);
      return inventorySnapshot(query.page, query.pageSize);
    },
    { query: paging },
  )
  .get(
    "/fulfillment/orders",
    async ({ request, query }) => {
      await requireActor(request, ["admin", "ops", "manager", "rep"]);
      return fulfillmentList(query.page, query.pageSize);
    },
    { query: paging },
  )
  .get(
    "/fulfillment/:id",
    async ({ request, params: p }) => {
      await requireActor(request, ["admin", "ops", "manager", "rep"]);
      return fulfillmentDetail(p.id);
    },
    { params },
  )
  .post(
    "/fulfillment/:id/accept",
    async ({ request, params: p }) =>
      acceptSplit(p.id, await requireActor(request, ["admin", "ops"])),
    { params },
  )
  .post(
    "/fulfillment/:id/consolidate",
    async ({ request, params: p }) =>
      consolidateBackorder(p.id, await requireActor(request, ["admin", "ops"])),
    { params },
  )
  .post(
    "/fulfillment/:id/override",
    async ({ request, params: p, body }) =>
      overrideSplit(
        p.id,
        body.allocations,
        body.reason,
        await requireActor(request, ["admin", "ops"]),
      ),
    {
      params,
      body: t.Object(
        {
          allocations: t.Array(t.Object({ productId: id, quantity: positive, warehouseId: id }), {
            maxItems: 300,
          }),
          reason,
        },
        { additionalProperties: false },
      ),
    },
  )
  .post(
    "/fulfillment/:id/ship",
    async ({ request, params: p, body }) =>
      shipReservation(p.id, body, await requireActor(request, ["admin", "ops"])),
    {
      params,
      body: t.Object(
        { operationKey: id, quantity: positive, reservationId: id },
        { additionalProperties: false },
      ),
    },
  )
  .post(
    "/inventory/restock",
    async ({ request, body }) => restock(body, await requireActor(request, ["admin", "ops"])),
    {
      body: t.Object(
        { operationKey: id, productId: id, quantity: positive, reason, warehouseId: id },
        { additionalProperties: false },
      ),
    },
  )
  .post(
    "/inventory/warehouses",
    async ({ request, body }) =>
      saveWarehouse(
        undefined,
        { ...body, id: crypto.randomUUID() },
        await requireActor(request, ["admin"]),
      ),
    { body: warehouseBody },
  )
  .patch(
    "/inventory/warehouses/:id",
    async ({ request, params: p, body }) =>
      saveWarehouse(p.id, { ...body, id: p.id }, await requireActor(request, ["admin"])),
    { params, body: warehouseBody },
  )
  .post(
    "/inventory/stocks",
    async ({ request, body }) => {
      const actor = await requireActor(request, ["admin"]);
      return db.transaction(async (tx) => {
        const [product] = await tx.select().from(products).where(eq(products.id, body.productId));
        if (!product?.stockable) throw new DomainError("Choose a stockable product", 400);
        const [location] = await tx
          .select()
          .from(warehouses)
          .where(eq(warehouses.id, body.warehouseId));
        if (!location) throw new DomainError("Warehouse not found", 404);
        const [balance] = await tx
          .insert(stocks)
          .values({ id: crypto.randomUUID(), ...body })
          .onConflictDoUpdate({
            target: [stocks.warehouseId, stocks.productId],
            set: { id: sql`${stocks.id}` },
          })
          .returning();
        await audit(tx, actor, balance!.id, "STOCK_CONFIGURED", "Product enabled at warehouse");
        return balance;
      });
    },
    { body: t.Object({ productId: id, warehouseId: id }, { additionalProperties: false }) },
  );
