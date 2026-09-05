import { assertDisposableDatabase, requireDatabaseUrl } from "./_lib/database-url";
import { loadOptionalEnvFile } from "./_lib/load-env-file";
import { runCommand } from "./_lib/run-command";

const ROOT = import.meta.dir.replace(/[\\/]scripts$/, "");
await loadOptionalEnvFile(`${ROOT}/.env.test.local`);

const testDatabaseUrl = requireDatabaseUrl("TEST_DATABASE_URL");
assertDisposableDatabase(testDatabaseUrl, "test");

const command = Bun.argv[2];
if (command !== "migrate") throw new Error("Expected command: migrate");

await runCommand(["bun", "--bun", "x", "drizzle-kit", command], {
  cwd: ROOT,
  env: { ...Bun.env, DATABASE_URL: testDatabaseUrl },
});
