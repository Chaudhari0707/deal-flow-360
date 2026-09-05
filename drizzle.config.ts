import { defineConfig } from "drizzle-kit";

const databaseUrl = Bun.env.MIGRATION_DATABASE_URL ?? Bun.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("MIGRATION_DATABASE_URL or DATABASE_URL is required");
}

export default defineConfig({
  dbCredentials: { url: databaseUrl },
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./src/lib/db/schema/index.ts",
  strict: true,
  verbose: true,
});
