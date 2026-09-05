import { eq, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import {
  allocationPlanModel,
  fulfillmentDetailModel,
  fulfillmentListModel,
  inventorySnapshotModel,
  movementResponseModel,
  statusResponseModel,
} from "@/features/inventory/model";
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
import { actorContext } from "@/server/access";
import { audit } from "@/server/audit";
import { DomainError } from "@/server/errors";
import { apiErrorResponses, orderModel, stockModel, warehouseModel } from "@/server/models";

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

export const inventoryRoutes = new Elysia({
  name: "inventory",
  normalize: false,
  tags: ["Inventory"],
})
  .use(actorContext)
  .get("/inventory", async ({ query }) => await inventorySnapshot(query.page, query.pageSize), {
    authorize: ["admin", "ops", "manager", "rep"],
    query: paging,
    response: { 200: inventorySnapshotModel, ...apiErrorResponses },
  })
  .get(
    "/fulfillment/orders",
    async ({ query }) => await fulfillmentList(query.page, query.pageSize),
    {
      authorize: ["admin", "ops", "manager", "rep"],
      query: paging,
      response: { 200: fulfillmentListModel, ...apiErrorResponses },
    },
  )
  .get("/fulfillment/:id", async ({ params: p }) => await fulfillmentDetail(p.id), {
    authorize: ["admin", "ops", "manager", "rep"],
    params,
    response: { 200: fulfillmentDetailModel, ...apiErrorResponses },
  })
  .post("/fulfillment/:id/accept", async ({ actor, params: p }) => await acceptSplit(p.id, actor), {
    authorize: ["ops"],
    params,
    response: { 200: orderModel, ...apiErrorResponses },
  })
  .post(
    "/fulfillment/:id/consolidate",
    async ({ actor, params: p }) => await consolidateBackorder(p.id, actor),
    {
      authorize: ["admin", "ops"],
      params,
      response: { 200: allocationPlanModel, ...apiErrorResponses },
    },
  )
  .post(
    "/fulfillment/:id/override",
    async ({ actor, params: p, body }) =>
      await overrideSplit(p.id, body.allocations, body.reason, actor),
    {
      authorize: ["ops"],
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
      response: { 200: statusResponseModel, ...apiErrorResponses },
    },
  )
  .post(
    "/fulfillment/:id/ship",
    async ({ actor, params: p, body }) => await shipReservation(p.id, body, actor),
    {
      authorize: ["ops"],
      params,
      body: t.Object(
        { operationKey: id, quantity: positive, reservationId: id },
        { additionalProperties: false },
      ),
      response: { 200: movementResponseModel, ...apiErrorResponses },
    },
  )
  .post("/inventory/restock", async ({ actor, body }) => await restock(body, actor), {
    authorize: ["admin"],
    body: t.Object(
      { operationKey: id, productId: id, quantity: positive, reason, warehouseId: id },
      { additionalProperties: false },
    ),
    response: { 200: movementResponseModel, ...apiErrorResponses },
  })
  .post(
    "/inventory/warehouses",
    async ({ actor, body }) =>
      await saveWarehouse(undefined, { ...body, id: crypto.randomUUID() }, actor),
    {
      authorize: ["admin"],
      body: warehouseBody,
      response: { 200: warehouseModel, ...apiErrorResponses },
    },
  )
  .patch(
    "/inventory/warehouses/:id",
    async ({ actor, params: p, body }) => await saveWarehouse(p.id, { ...body, id: p.id }, actor),
    {
      authorize: ["admin"],
      params,
      body: warehouseBody,
      response: { 200: warehouseModel, ...apiErrorResponses },
    },
  )
  .post(
    "/inventory/stocks",
    async ({ actor, body }) => {
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
    {
      authorize: ["admin"],
      body: t.Object({ productId: id, warehouseId: id }, { additionalProperties: false }),
      response: { 200: stockModel, ...apiErrorResponses },
    },
  );
