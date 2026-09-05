import { assertDisposableDatabase, requireDatabaseUrl } from "./_lib/database-url";
import { runCommand } from "./_lib/run-command";

const ROOT = import.meta.dir.replace(/[\\/]scripts$/, "");
const databaseUrl = requireDatabaseUrl("DATABASE_URL");
assertDisposableDatabase(databaseUrl, "development");

await runCommand(["bun", "run", "env:check"], { cwd: ROOT });
await runCommand(["bun", "run", "db:migrate"], { cwd: ROOT });
await runCommand(["bun", "run", "db:seed"], { cwd: ROOT });

console.log("dev:setup complete");
