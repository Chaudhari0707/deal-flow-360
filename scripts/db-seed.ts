import {
  assertDisposableDatabase,
  describeDatabaseUrl,
  requireDatabaseUrl,
} from "./_lib/database-url";

const databaseUrl = requireDatabaseUrl("DATABASE_URL");
const target = Bun.argv.includes("--allow-remote")
  ? describeDatabaseUrl(databaseUrl)
  : assertDisposableDatabase(databaseUrl, "development");
if (Bun.argv.includes("--allow-remote"))
  console.warn("db:seed: remote seeding explicitly enabled; use only with synthetic data");
console.log(`db:seed target ${target.host}:${target.port}/${target.database}`);

const [{ closeDatabase, db }, { seedDatabase }] = await Promise.all([
  import("@/lib/db/connection"),
  import("@/lib/db/seed"),
]);

try {
  await seedDatabase(db);
} finally {
  await closeDatabase();
}
