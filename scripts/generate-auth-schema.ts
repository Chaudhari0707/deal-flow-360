import { runCommand } from "./_lib/run-command";

const ROOT = import.meta.dir.replace(/[\\/]scripts$/, "");
const command = [
  "bun",
  "--bun",
  "x",
  "better-auth",
  "generate",
  "--config",
  "scripts/better-auth.config.ts",
  "--output",
  "src/lib/db/schema/auth.ts",
];

if (Bun.argv.includes("--force")) command.push("--yes");

await runCommand(command, { cwd: ROOT });
await runCommand(["bun", "--bun", "x", "oxlint", "--fix", "src/lib/db/schema/auth.ts"], {
  cwd: ROOT,
});
