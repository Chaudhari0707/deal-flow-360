import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "@/lib/db/schema/auth";
import type { QuoteLine, QuoteStatus, RiskSnapshot, Role } from "@/lib/domain/_types/domain";

export const customers = pgTable("customers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  tier: text("tier").notNull().default("Bronze"),
  team: text("team").notNull().default("Enterprise"),
});

export const profiles = pgTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  role: text("role").$type<Role>().notNull().default("rep"),
  customerId: text("customer_id").references(() => customers.id),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
});

export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    description: text("description").notNull().default(""),
    unit: text("unit").notNull().default("unit"),
    priceCents: integer("price_cents").notNull(),
    costCents: integer("cost_cents").notNull(),
    taxBps: integer("tax_bps").notNull().default(0),
    stockable: boolean("stockable").notNull().default(false),
    intervalMonths: integer("interval_months").notNull().default(0),
    variant: text("variant").notNull().default("Standard"),
    active: boolean("active").notNull().default(true),
    promoted: boolean("promoted").notNull().default(false),
    promotionBps: integer("promotion_bps").notNull().default(0),
    pairedProductIds: jsonb("paired_product_ids").$type<string[]>().notNull().default([]),
  },
  (t) => [
    check(
      "product_amounts",
      sql`${t.priceCents} >= 0 AND ${t.costCents} >= 0 AND ${t.taxBps} BETWEEN 0 AND 10000`,
    ),
  ],
);

export const settings = pgTable("settings", {
  id: text("id").primaryKey(),
  value: jsonb("value").$type<Record<string, number>>().notNull(),
});

export const quotes = pgTable(
  "quotes",
  {
    id: text("id").primaryKey(),
    number: text("number").notNull().unique(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id),
    status: text("status").$type<QuoteStatus>().notNull().default("DRAFT"),
    revision: integer("revision").notNull().default(1),
    approvedRevision: integer("approved_revision"),
    approvalStep: text("approval_step").$type<"manager" | "finance">(),
    lines: jsonb("lines").$type<QuoteLine[]>().notNull().default([]),
    orderDiscountBps: integer("order_discount_bps").notNull().default(0),
    risk: text("risk").$type<RiskSnapshot["risk"]>().notNull().default("NONE"),
    riskSnapshot: jsonb("risk_snapshot").$type<RiskSnapshot>(),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    marginCents: integer("margin_cents").notNull().default(0),
    recurringCents: integer("recurring_cents").notNull().default(0),
    promisedDate: text("promised_date"),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("quotes_owner_status").on(t.ownerId, t.status, t.createdAt)],
);

export const quoteRevisions = pgTable(
  "quote_revisions",
  {
    id: text("id").primaryKey(),
    quoteId: text("quote_id")
      .notNull()
      .references(() => quotes.id),
    revision: integer("revision").notNull(),
    lines: jsonb("lines").$type<QuoteLine[]>().notNull(),
    riskSnapshot: jsonb("risk_snapshot").$type<RiskSnapshot>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("quote_revision_unique").on(t.quoteId, t.revision)],
);

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  quoteId: text("quote_id")
    .notNull()
    .unique()
    .references(() => quotes.id),
  number: text("number").notNull().unique(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id),
  lines: jsonb("lines").$type<QuoteLine[]>().notNull(),
  fulfillmentStatus: text("fulfillment_status").notNull().default("SPLIT_PENDING"),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  promisedDate: text("promised_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditEntries = pgTable(
  "audit_entries",
  {
    id: text("id").primaryKey(),
    entityId: text("entity_id").notNull(),
    actorId: text("actor_id").references(() => user.id),
    actorName: text("actor_name").notNull(),
    action: text("action").notNull(),
    reason: text("reason").notNull().default(""),
    revision: integer("revision"),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_entity_time").on(t.entityId, t.createdAt)],
);

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  quoteId: text("quote_id")
    .notNull()
    .references(() => quotes.id),
  lineId: text("line_id"),
  authorId: text("author_id").references(() => user.id),
  authorName: text("author_name").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const quoteAccess = pgTable("quote_access", {
  id: text("id").primaryKey(),
  quoteId: text("quote_id")
    .notNull()
    .references(() => quotes.id),
  digest: text("digest").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
  sessionDigest: text("session_digest"),
  sessionExpiresAt: timestamp("session_expires_at", { withTimezone: true }),
  revoked: boolean("revoked").notNull().default(false),
});

export const deliveries = pgTable("deliveries", {
  id: text("id").primaryKey(),
  quoteId: text("quote_id")
    .notNull()
    .references(() => quotes.id),
  revision: integer("revision").notNull(),
  status: text("status").$type<"PENDING" | "SENT" | "FAILED">().notNull().default("PENDING"),
  providerId: text("provider_id"),
  error: text("error"),
  attempts: integer("attempts").notNull().default(0),
  encryptedPayload: text("encrypted_payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
