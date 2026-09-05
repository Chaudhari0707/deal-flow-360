import { Glob } from "bun";

const ROOT = import.meta.dir.replace(/[\\/]scripts$/, "");
const ROOT_BUDGET = 16 * 1024;
const ROUTED_BUDGET = 12 * 1024;
const failures: string[] = [];

async function read(path: string) {
  return Bun.file(`${ROOT}/${path}`).text();
}

for await (const path of new Glob("**/AGENTS.override.md").scan({ cwd: ROOT, onlyFiles: true })) {
  if (!path.includes("node_modules/")) failures.push(`${path}: override files are not allowed`);
}

const rootPolicy = Bun.file(`${ROOT}/AGENTS.md`);
if (!(await rootPolicy.exists())) {
  failures.push("AGENTS.md: missing root policy");
} else if (rootPolicy.size > ROOT_BUDGET) {
  failures.push(`AGENTS.md: ${rootPolicy.size} bytes exceeds ${ROOT_BUDGET}`);
}

for await (const path of new Glob(".agents/*.md").scan({ cwd: ROOT, onlyFiles: true })) {
  const file = Bun.file(`${ROOT}/${path}`);
  if (file.size > ROUTED_BUDGET)
    failures.push(`${path}: ${file.size} bytes exceeds ${ROUTED_BUDGET}`);
}

const routeIndex = await read(".agents/index.md");
for (const match of routeIndex.matchAll(/`(\.agents\/[^`]+\.md)`/g)) {
  const path = match[1];
  if (!(await Bun.file(`${ROOT}/${path}`).exists()))
    failures.push(`${path}: routed file is missing`);
}

const packageJson = JSON.parse(await read("package.json")) as {
  scripts?: Record<string, string>;
};
const packageScripts = new Set(Object.keys(packageJson.scripts ?? {}));
const instructionPaths = ["AGENTS.md", "README.md", "CONTRIBUTING.md"];

for (const pattern of [".agents/*.md", "docs/**/*.md"]) {
  for await (const path of new Glob(pattern).scan({ cwd: ROOT, onlyFiles: true })) {
    instructionPaths.push(path.replaceAll("\\", "/"));
  }
}

for (const path of instructionPaths) {
  for (const match of (await read(path)).matchAll(/`bun run ([a-z][a-z0-9:-]*)/g)) {
    const command = match[1];
    if (!packageScripts.has(command))
      failures.push(`${path}: unknown package command '${command}'`);
  }
}

const mcpJson = JSON.parse(await read(".mcp.json")) as {
  mcpServers?: Record<string, unknown>;
};
const jsonServers = Object.keys(mcpJson.mcpServers ?? {}).sort();
const codexConfig = await read(".codex/config.toml");
const tomlServers = [...codexConfig.matchAll(/^\[mcp_servers\.([^\]]+)\]$/gm)]
  .map((match) => match[1])
  .sort();

if (jsonServers.join("\n") !== tomlServers.join("\n")) {
  failures.push("MCP server names differ between .mcp.json and .codex/config.toml");
}

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  throw new Error("instruction checks failed");
}

console.log("instructions: routes, commands, MCP parity, and budgets are valid");
