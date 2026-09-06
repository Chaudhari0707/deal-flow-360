import { sql } from "drizzle-orm";
import { check, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { customers, orders, products } from "@/lib/db/schema/commerce";
import type { QuoteLine } from "@/lib/domain/_types/domain";

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    name: text("name").notNull(),
    quantity: integer("quantity").notNull(),
    priceCents: integer("price_cents").notNull(),
    periodNetCents: integer("period_net_cents").notNull(),
    priceBasisCents: integer("price_basis_cents").notNull(),
    priceBasisQuantity: integer("price_basis_quantity").notNull(),
    taxBps: integer("tax_bps").notNull().default(0),
    intervalMonths: integer("interval_months").notNull(),
    anchorDay: integer("anchor_day").notNull(),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("subscription_amounts", sql`${t.quantity} > 0 AND ${t.priceCents} >= 0`)],
);
export const invoices = pgTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    number: text("number").notNull().unique(),
    operationKey: text("operation_key").notNull().unique(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id),
    subscriptionId: text("subscription_id").references(() => subscriptions.id),
    kind: text("kind").notNull().default("ONE_TIME"),
    lines: jsonb("lines").$type<QuoteLine[]>().notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    taxCents: integer("tax_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    paidCents: integer("paid_cents").notNull().default(0),
    creditedCents: integer("credited_cents").notNull().default(0),
    status: text("status").notNull().default("UNPAID"),
    dueDate: text("due_date").notNull(),
    periodStart: text("period_start"),
    periodEnd: text("period_end"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "invoice_bounds",
      sql`${t.totalCents} >= 0 AND ${t.paidCents} >= 0 AND ${t.creditedCents} >= 0 AND ${t.paidCents} + ${t.creditedCents} <= ${t.totalCents}`,
    ),
  ],
);
export const invoiceDeliveries = pgTable("invoice_deliveries", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .unique()
    .references(() => orders.id, { onDelete: "cascade" }),
  recipient: text("recipient").notNull(),
  invoiceIds: jsonb("invoice_ids").$type<string[]>().notNull(),
  status: text("status").$type<"PENDING" | "SENT" | "FAILED">().notNull().default("PENDING"),
  providerId: text("provider_id"),
  error: text("error"),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => invoices.id),
  operationKey: text("operation_key").notNull().unique(),
  amountCents: integer("amount_cents").notNull(),
  reference: text("reference").notNull(),
  actorId: text("actor_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const credits = pgTable(
  "credits",
  {
    id: text("id").primaryKey(),
    number: text("number").notNull().unique(),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id),
    subscriptionId: text("subscription_id").references(() => subscriptions.id),
    operationKey: text("operation_key").notNull().unique(),
    amountCents: integer("amount_cents").notNull(),
    appliedCents: integer("applied_cents").notNull().default(0),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("credit_bounds", sql`${t.amountCents} >= ${t.appliedCents} AND ${t.appliedCents} >= 0`),
  ],
);
