import { expect, test as setup } from "@playwright/test";

const authState = `${import.meta.dir}/.auth/user.json`;

setup("authenticate through Better Auth", async ({ request }) => {
  const email = Bun.env.PLAYWRIGHT_USER_EMAIL;
  const password = Bun.env.PLAYWRIGHT_USER_PASSWORD;

  if (!email || !password) {
    throw new Error("PLAYWRIGHT_USER_EMAIL and PLAYWRIGHT_USER_PASSWORD are required");
  }

  const response = await request.post("/api/auth/sign-in/email", {
    data: { email, password, rememberMe: false },
  });
  expect(response.ok(), await response.text()).toBe(true);
  await request.storageState({ path: authState });
});
