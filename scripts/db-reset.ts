import { reset } from "drizzle-seed";

import { assertDisposableDatabase, requireDatabaseUrl } from "./_lib/database-url";

const databaseUrl = requireDatabaseUrl("DATABASE_URL");
const target = assertDisposableDatabase(databaseUrl, "development");

console.log(`db:reset target ${target.host}:${target.port}/${target.database}`);
if (Bun.argv.includes("--dry-run")) {
  console.log("db:reset dry run: no changes made");
} else {
  if (!Bun.argv.includes("--force")) throw new Error("db:reset requires --force");

  const [{ closeDatabase, db }, schema, { seedDatabase }] = await Promise.all([
    import("@/lib/db/connection"),
    import("@/lib/db/schema"),
    import("@/lib/db/seed"),
  ]);

  try {
    await reset(db, schema);
    if (Bun.argv.includes("--seed")) await seedDatabase(db);
  } finally {
    await closeDatabase();
  }
}
