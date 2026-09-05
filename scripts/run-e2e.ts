import { Glob } from "bun";

import { assertDisposableDatabase, requireDatabaseUrl } from "./_lib/database-url";
import { loadOptionalEnvFile } from "./_lib/load-env-file";
import { runCommand } from "./_lib/run-command";

const ROOT = import.meta.dir.replace(/[\\/]scripts$/, "");
let hasSpecs = false;
for await (const _path of new Glob("playwright/e2e/**/*.spec.ts").scan({
  cwd: ROOT,
  onlyFiles: true,
})) {
  hasSpecs = true;
  break;
}

if (!hasSpecs) {
  console.log("test:e2e: skipped until browser specs exist");
} else {
  await loadOptionalEnvFile(`${ROOT}/.env.test.local`);
  const externalServer = Boolean(Bun.env.PLAYWRIGHT_BASE_URL);
  const env: Record<string, boolean | string | undefined> = { ...Bun.env };

  if (externalServer) {
    console.log("test:e2e: external server selected; database preparation is disabled");
  } else {
    const testDatabaseUrl = requireDatabaseUrl("TEST_DATABASE_URL");
    assertDisposableDatabase(testDatabaseUrl, "test");
    env.DATABASE_URL = testDatabaseUrl;
    env.BETTER_AUTH_URL = "http://127.0.0.1:3001";
    await runCommand(["bun", "run", "scripts/db-test-command.ts", "migrate"], { cwd: ROOT, env });
    await runCommand(["bun", "run", "scripts/db-test-reset.ts"], { cwd: ROOT, env });
  }

  const forwardedArgs = Bun.argv.slice(2);
  await runCommand(["bun", "--bun", "playwright", "test", ...forwardedArgs], {
    cwd: ROOT,
    env,
  });
}
