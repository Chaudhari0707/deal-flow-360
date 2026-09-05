import { reset } from "drizzle-seed";

import { assertDisposableDatabase, requireDatabaseUrl } from "./_lib/database-url";
import { loadOptionalEnvFile } from "./_lib/load-env-file";

const ROOT = import.meta.dir.replace(/[\\/]scripts$/, "");
await loadOptionalEnvFile(`${ROOT}/.env.test.local`);

const testDatabaseUrl = requireDatabaseUrl("TEST_DATABASE_URL");
const target = assertDisposableDatabase(testDatabaseUrl, "test");
console.log(`db:test:reset target ${target.host}:${target.port}/${target.database}`);

Bun.env.DATABASE_URL = testDatabaseUrl;
const [{ closeDatabase, db }, schema, { seedDatabase }] = await Promise.all([
  import("@/lib/db/connection"),
  import("@/lib/db/schema"),
  import("@/lib/db/seed"),
]);

try {
  await reset(db, schema);
  await seedDatabase(db);
} finally {
  await closeDatabase();
}
