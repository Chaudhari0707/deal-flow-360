import { assertDisposableDatabase, requireDatabaseUrl } from "./_lib/database-url";
import { runCommand } from "./_lib/run-command";

const databaseUrl = requireDatabaseUrl("DATABASE_URL");
const target = assertDisposableDatabase(databaseUrl, "development");

console.log(`db:push target ${target.host}:${target.port}/${target.database}`);
if (Bun.argv.includes("--dry-run")) {
  console.log("db:push dry run: no changes made");
} else {
  if (!Bun.argv.includes("--force")) throw new Error("db:push requires --force");
  await runCommand(["bun", "--bun", "x", "drizzle-kit", "push"]);
}
