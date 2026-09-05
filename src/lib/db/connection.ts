import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/lib/db/schema";

function databaseUrl() {
  const value = Bun.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is required");
  return value;
}

type DatabaseGlobal = typeof globalThis & { dealFlowSql?: ReturnType<typeof postgres> };

const databaseGlobal = globalThis as DatabaseGlobal;
const client =
  databaseGlobal.dealFlowSql ??
  postgres(databaseUrl(), {
    connect_timeout: 10,
    connection: {
      application_name: "deal-flow-360",
      statement_timeout: 15_000,
    },
    idle_timeout: 20,
    max: 5,
    max_lifetime: 1_800,
    onnotice: () => {},
    prepare: Bun.env.POSTGRES_PREPARE !== "false",
  });

if (Bun.env.NODE_ENV === "development") databaseGlobal.dealFlowSql = client;

export const db = drizzle(client, { schema });

export async function closeDatabase() {
  await client.end();
}
