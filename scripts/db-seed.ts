import { assertDisposableDatabase, requireDatabaseUrl } from "./_lib/database-url";

const databaseUrl = requireDatabaseUrl("DATABASE_URL");
const target = assertDisposableDatabase(databaseUrl, "development");
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
