import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { db } from "@/lib/db/connection";
import { customers, products, settings } from "@/lib/db/schema";
import { requireActor } from "@/server/access";
import { audit } from "@/server/audit";
import { DomainError } from "@/server/errors";

const id = t.String({ minLength: 1, maxLength: 100 }),
  name = t.String({ minLength: 1, maxLength: 120 }),
  cents = t.Integer({ minimum: 0, maximum: 10000000 });
const productBody = t.Object(
  {
    name,
    category: t.Union([t.Literal("Hardware"), t.Literal("Services"), t.Literal("Subscription")]),
    priceCents: cents,
    costCents: cents,
    taxBps: t.Integer({ minimum: 0, maximum: 10000 }),
    intervalMonths: t.Union([t.Literal(0), t.Literal(1), t.Literal(3), t.Literal(12)]),
    stockable: t.Boolean(),
    description: t.Optional(t.String({ maxLength: 2000 })),
    unit: t.Optional(name),
    variant: t.Optional(name),
    active: t.Optional(t.Boolean()),
    promoted: t.Optional(t.Boolean()),
    promotionBps: t.Optional(t.Integer({ minimum: 0, maximum: 10000 })),
    pairedProductIds: t.Optional(t.Array(id, { maxItems: 20 })),
  },
  { additionalProperties: false },
);
const customerBody = t.Object(
  {
    name,
    email: t.String({ format: "email" }),
    tier: t.Union([t.Literal("Bronze"), t.Literal("Silver"), t.Literal("Gold")]),
    team: t.Optional(name),
  },
  { additionalProperties: false },
);

export const catalogRoutes = new Elysia({ name: "catalog" })
  .post(
    "/catalog/products",
    async ({ request, body }) => {
      const actor = await requireActor(request, ["admin"]);
      if (body.stockable && body.intervalMonths > 0)
        throw new DomainError("Recurring plans are not stockable");
      return db.transaction(async (tx) => {
        const [p] = await tx
          .insert(products)
          .values({ id: crypto.randomUUID(), ...body })
          .returning();
        await audit(tx, actor, p!.id, "PRODUCT_CREATED", "Catalog product created");
        return p;
      });
    },
    { body: productBody },
  )
  .patch(
    "/catalog/products/:id",
    async ({ request, body, params }) => {
      const actor = await requireActor(request, ["admin"]);
      if (body.stockable && body.intervalMonths > 0)
        throw new DomainError("Recurring plans are not stockable");
      return db.transaction(async (tx) => {
        const [p] = await tx
          .update(products)
          .set(body)
          .where(eq(products.id, params.id))
          .returning();
        if (!p) throw new DomainError("Product not found", 404);
        await audit(tx, actor, p.id, "PRODUCT_UPDATED", "Catalog configuration changed", body);
        return p;
      });
    },
    { params: t.Object({ id }), body: productBody },
  )
  .post(
    "/customers",
    async ({ request, body }) => {
      await requireActor(request, ["rep", "manager", "admin"]);
      const [customer] = await db
        .insert(customers)
        .values({ id: crypto.randomUUID(), ...body })
        .returning();
      return customer;
    },
    { body: customerBody },
  )
  .patch(
    "/customers/:id",
    async ({ request, body, params }) => {
      const actor = await requireActor(request, ["manager", "admin"]);
      return db.transaction(async (tx) => {
        const [customer] = await tx
          .update(customers)
          .set(body)
          .where(eq(customers.id, params.id))
          .returning();
        if (!customer) throw new DomainError("Customer not found", 404);
        await audit(
          tx,
          actor,
          customer.id,
          "CUSTOMER_UPDATED",
          "Customer tier/contact updated",
          body,
        );
        return customer;
      });
    },
    { params: t.Object({ id }), body: customerBody },
  )
  .patch(
    "/settings/:id",
    async ({ request, body, params }) => {
      const actor = await requireActor(request, ["manager", "admin"]);
      const allowed: Record<string, string[]> = {
        discounts: [
          "Bronze",
          "Silver",
          "Gold",
          "Hardware",
          "Services",
          "Subscription",
          "highLineBps",
          "highTotalBps",
        ],
        health: ["stallDays", "anomalyBps", "historyDays"],
        upsell: ["minimumMarginBps"],
      };
      if (
        !allowed[params.id] ||
        Object.keys(body.value).some((key) => !allowed[params.id]!.includes(key))
      )
        throw new DomainError("Unsupported setting");
      if (
        Object.values(body.value).some(
          (value) => !Number.isInteger(value) || value < 0 || value > 10000,
        )
      )
        throw new DomainError("Settings must be integers from 0 to 10,000");
      if (
        params.id === "discounts" &&
        ((body.value.highLineBps ?? 1) < 1 || (body.value.highTotalBps ?? 1) < 1)
      )
        throw new DomainError("Risk thresholds must be positive");
      return db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(settings)
          .where(eq(settings.id, params.id))
          .for("update");
        const value = { ...current?.value, ...body.value };
        await tx
          .insert(settings)
          .values({ id: params.id, value })
          .onConflictDoUpdate({ target: settings.id, set: { value } });
        await audit(tx, actor, params.id, "SETTINGS_UPDATED", "Business policy updated", value);
        return { id: params.id, value };
      });
    },
    {
      params: t.Object({ id }),
      body: t.Object({ value: t.Record(t.String(), t.Number()) }, { additionalProperties: false }),
    },
  );
