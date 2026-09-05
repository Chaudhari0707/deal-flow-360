import { Glob } from "bun";

import { assertDisposableDatabase, requireDatabaseUrl } from "./_lib/database-url";
import { loadOptionalEnvFile } from "./_lib/load-env-file";
import { runCommand } from "./_lib/run-command";

const ROOT = import.meta.dir.replace(/[\\/]scripts$/, "");
const suite = Bun.argv[2];

if (!new Set(["integration", "regression", "unit"]).has(suite)) {
  throw new Error("Expected suite: unit, integration, or regression");
}

const files: string[] = [];
for await (const path of new Glob("test/**/*.{ts,tsx}").scan({ cwd: ROOT, onlyFiles: true })) {
  const normalizedPath = path.replaceAll("\\", "/");
  if (suite === "unit" && normalizedPath.includes("/unit/") && /\.(test|spec)\./.test(path)) {
    files.push(normalizedPath);
  }
  if (
    suite === "integration" &&
    normalizedPath.includes("/integration/") &&
    /\.(test|spec)\./.test(path)
  ) {
    files.push(normalizedPath);
  }
  if (suite === "regression" && normalizedPath.includes(".regression.")) {
    files.push(normalizedPath);
  }
}

if (files.length === 0) {
  console.log(`test:${suite}: skipped until matching tests exist`);
} else {
  const needsDatabase =
    suite === "integration" || files.some((path) => path.includes("/integration/"));
  let env: Record<string, boolean | string | undefined> = { ...Bun.env };

  if (needsDatabase) {
    await loadOptionalEnvFile(`${ROOT}/.env.test.local`);
    const testDatabaseUrl = requireDatabaseUrl("TEST_DATABASE_URL");
    assertDisposableDatabase(testDatabaseUrl, "test");
    env = { ...Bun.env, DATABASE_URL: testDatabaseUrl };
    await runCommand(["bun", "run", "scripts/db-test-command.ts", "migrate"], {
      cwd: ROOT,
      env,
    });
    await runCommand(["bun", "run", "scripts/db-test-reset.ts"], { cwd: ROOT, env });
  }

  files.sort();
  // Never inherit a live email key into normal tests. Provider-contract fixtures
  // install their own fake key and mock Resend explicitly.
  env.RESEND_API_KEY = "";
  await runCommand(["bun", "test", "--isolate", "--timeout", "5000", ...files], {
    cwd: ROOT,
    env,
  });
}
