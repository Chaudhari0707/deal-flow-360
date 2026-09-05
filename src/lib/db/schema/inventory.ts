import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { orders, products } from "@/lib/db/schema/commerce";

export const warehouses = pgTable("warehouses", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  shippingWeight: integer("shipping_weight").notNull(),
  active: boolean("active").notNull().default(true),
  replenishmentThreshold: integer("replenishment_threshold").notNull().default(5),
});
export const stocks = pgTable(
  "stocks",
  {
    id: text("id").primaryKey(),
    warehouseId: text("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    onHand: integer("on_hand").notNull().default(0),
    reserved: integer("reserved").notNull().default(0),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    uniqueIndex("stock_location_unique").on(t.warehouseId, t.productId),
    check("stock_nonnegative", sql`${t.onHand} >= ${t.reserved} AND ${t.reserved} >= 0`),
  ],
);
export const reservations = pgTable(
  "reservations",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    warehouseId: text("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    quantity: integer("quantity").notNull(),
    shipped: integer("shipped").notNull().default(0),
  },
  (t) => [
    uniqueIndex("reservation_location_unique").on(t.orderId, t.productId, t.warehouseId),
    check("reservation_bounds", sql`${t.quantity} >= ${t.shipped} AND ${t.shipped} >= 0`),
  ],
);
export const stockMovements = pgTable("stock_movements", {
  id: text("id").primaryKey(),
  operationKey: text("operation_key").notNull().unique(),
  warehouseId: text("warehouse_id")
    .notNull()
    .references(() => warehouses.id),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  orderId: text("order_id").references(() => orders.id),
  actorId: text("actor_id").notNull(),
  quantity: integer("quantity").notNull(),
  kind: text("kind").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
