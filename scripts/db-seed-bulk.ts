import { bulkSeedCounts, parseBulkOptions } from "@/lib/db/seed/bulk-options";

import { assertDisposableDatabase, requireDatabaseUrl } from "./_lib/database-url";

async function main() {
  const options = parseBulkOptions(Bun.argv.slice(2));
  if (options.help) {
    console.log(
      "Usage: bun run db:seed:bulk [--count 100] [--batch review] [--as-of YYYY-MM-DD] [--dry-run]",
    );
    console.log(
      "Local _dev database only. Same batch skips existing scenarios; new batch adds more. No reset or email delivery.",
    );
    return;
  }
  if (Bun.env.NODE_ENV === "production") throw new Error("Bulk seed is disabled in production");
  const target = assertDisposableDatabase(requireDatabaseUrl("DATABASE_URL"), "development");
  console.log(`db:seed:bulk target ${target.host}:${target.port}/${target.database}`);
  console.log(
    JSON.stringify({
      batch: options.batch,
      asOf: options.asOf,
      maximumNewRecords: bulkSeedCounts(options.count),
      dryRun: options.dryRun,
    }),
  );
  if (options.dryRun) {
    console.log(
      "Preview only; database was not opened. Already completed scenarios will be skipped when applied.",
    );
    return;
  }
  const [{ db, closeDatabase }, { seedBulkData }] = await Promise.all([
    import("@/lib/db/connection"),
    import("@/lib/db/seed/bulk"),
  ]);
  try {
    console.log(JSON.stringify(await seedBulkData(db, options)));
  } catch {
    // Database/auth errors may include SQL parameters. Never dump their payloads.
    throw new Error(
      "Bulk seed failed; the batch was rolled back. Check migrations, DEMO_PASSWORD (12+ characters), existing demo rep/finance/ops accounts (bun run db:seed), and use a fresh batch name if sample identifiers conflict.",
    );
  } finally {
    await closeDatabase();
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Bulk seed failed");
  process.exitCode = 1;
}
