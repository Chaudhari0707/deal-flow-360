import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "@/lib/db/schema/auth";
import { customers } from "@/lib/db/schema/commerce";

export const customerInvitations = pgTable("customer_invitations", {
  id: text("id").primaryKey(),
  customerId: text("customer_id")
    .notNull()
    .unique()
    .references(() => customers.id),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id),
  encryptedPayload: text("encrypted_payload").notNull(),
  recipient: text("recipient").notNull(),
  status: text("status").$type<"PENDING" | "SENT" | "FAILED">().notNull().default("PENDING"),
  providerId: text("provider_id"),
  error: text("error"),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
