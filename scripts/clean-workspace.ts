import { $ } from "bun";

const ROOT = import.meta.dir.replace(/[\\/]scripts$/, "");
const generatedTargets = [
  ".next",
  "build",
  "coverage",
  "lint-rules/dist",
  "out",
  "playwright-report",
  "test-results",
  "tsconfig.tsbuildinfo",
];

if (Bun.argv.includes("--dependencies")) {
  if (!Bun.argv.includes("--force")) {
    throw new Error("Removing dependencies requires --force");
  }
  generatedTargets.push("node_modules");
}

for (const target of generatedTargets) {
  const absolutePath = `${ROOT}/${target}`;
  if (!absolutePath.startsWith(`${ROOT}/`) || absolutePath === ROOT) {
    throw new Error(`Unsafe clean target: ${absolutePath}`);
  }

  await $`rm -rf ${absolutePath}`.quiet();
  console.log(`clean: removed ${target}`);
}
