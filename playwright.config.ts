import { defineConfig, devices } from "@playwright/test";

const baseURL = Bun.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001";
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
    : {
        command: "bun run dev --port 3001",
        reuseExistingServer: Bun.env.PLAYWRIGHT_REUSE_SERVER === "true",
        timeout: 120_000,
        url: `${baseURL}/api/v1/health`,
      },
});
