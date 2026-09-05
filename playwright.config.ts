import { defineConfig, devices } from "@playwright/test";

import { assertDisposableDatabase, requireDatabaseUrl } from "./scripts/_lib/database-url";

const baseURL = Bun.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001";
const testDatabaseUrl = Bun.env.PLAYWRIGHT_BASE_URL ? "" : requireDatabaseUrl("TEST_DATABASE_URL");
if (testDatabaseUrl) assertDisposableDatabase(testDatabaseUrl, "test");

const authState = `${import.meta.dir}/playwright/.auth/user.json`;

export default defineConfig({
  testDir: "./playwright",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "auth-setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      testIgnore: [/auth\.setup\.ts/, /\.authenticated\.spec\.ts/],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-authenticated",
      dependencies: ["auth-setup"],
      testMatch: /\.authenticated\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: authState },
    },
  ],
  webServer: Bun.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : [
        {
          name: "Next.js test application",
          command: "bun --bun next dev --hostname 127.0.0.1 --port 3001",
          env: {
            BETTER_AUTH_URL: baseURL,
            DATABASE_URL: testDatabaseUrl,
            NEXT_DIST_DIR: ".next-test",
            EMAIL_TRANSPORT: "test",
          },
          gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
          reuseExistingServer: Bun.env.PLAYWRIGHT_REUSE_SERVER === "true",
          timeout: 120_000,
          url: `${baseURL}/api/v1/health`,
        },
        {
          name: "Authenticated test stock feed",
          command: "bun run scripts/realtime.ts",
          env: {
            BETTER_AUTH_URL: baseURL,
            DATABASE_URL: testDatabaseUrl,
            REALTIME_PORT: "3102",
            AUTOMATIC_BILLING: "false",
          },
          gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
          reuseExistingServer: Bun.env.PLAYWRIGHT_REUSE_SERVER === "true",
          timeout: 30_000,
          url: "http://127.0.0.1:3102/health",
        },
      ],
});
