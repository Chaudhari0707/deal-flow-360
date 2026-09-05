import type {
  auditEntries,
  credits,
  customers,
  deliveries,
  invoices,
  messages,
  orders,
  products,
  quotes,
  reservations,
  settings,
  stocks,
  subscriptions,
  warehouses,
} from "@/lib/db/schema";
import type { Actor } from "@/lib/domain/_types/domain";

export type Serialized<T> = T extends Date
  ? string
  : T extends readonly (infer U)[]
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T;

export interface Workspace {
  activity: Serialized<typeof auditEntries.$inferSelect>[];
  actor: Actor;
  credits: Serialized<typeof credits.$inferSelect>[];
  customers: Serialized<typeof customers.$inferSelect>[];
  deliveries: Omit<Serialized<typeof deliveries.$inferSelect>, "encryptedPayload">[];
  invoices: Serialized<typeof invoices.$inferSelect>[];
  messages: Serialized<typeof messages.$inferSelect>[];
  orders: Serialized<typeof orders.$inferSelect>[];
  products: Serialized<typeof products.$inferSelect>[];
  quotes: Serialized<typeof quotes.$inferSelect>[];
  reservations: Serialized<typeof reservations.$inferSelect>[];
  settings: Serialized<typeof settings.$inferSelect>[];
  stocks: Serialized<typeof stocks.$inferSelect>[];
  subscriptions: Serialized<typeof subscriptions.$inferSelect>[];
  warehouses: Serialized<typeof warehouses.$inferSelect>[];
}
