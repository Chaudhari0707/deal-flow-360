import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type * as schema from "@/lib/db/schema";

export type AuthDatabase =
  | PostgresJsDatabase<typeof schema>
  | Parameters<Parameters<PostgresJsDatabase<typeof schema>["transaction"]>[0]>[0];
