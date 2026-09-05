import { expect, test } from "@playwright/test";

test("the alternate loopback hostname supports real login and authenticated customer creation @regression", async ({
  page,
  baseURL,
}) => {
  const email = Bun.env.PLAYWRIGHT_USER_EMAIL;
  const password = Bun.env.PLAYWRIGHT_USER_PASSWORD;
  if (!baseURL || !email || !password)
    throw new Error("Alias browser regression requires the local base URL and seeded credentials");
  const origin = new URL(baseURL);
  if (!["localhost", "127.0.0.1"].includes(origin.hostname))
    throw new Error("Alias browser regression requires a loopback base URL");
  origin.hostname = origin.hostname === "localhost" ? "127.0.0.1" : "localhost";
  await page.goto(`${origin.origin}/login`);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(`${origin.origin}/dashboard`);
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  const wrongPort = new URL(origin.origin);
  wrongPort.port = String(Number(origin.port || 80) + 1);
  // Better Auth disables its origin middleware under Bun's test environment, so exercise
  // its rejection behavior against the actual Next.js runtime with a genuine session cookie.
  for (const rejectedOrigin of ["https://foreign.example", wrongPort.origin]) {
    const rejected = await page.request.post(`${origin.origin}/api/auth/sign-in/email`, {
      headers: { origin: rejectedOrigin },
      data: { email, password },
    });
    expect(rejected.status()).toBe(403);
  }
  await page.goto(`${origin.origin}/catalog`);
  await page.getByRole("tab", { name: /^Customers ·/ }).click();
  await page.getByRole("button", { name: "Add customer", exact: true }).click();
  const name = `Loopback customer ${crypto.randomUUID()}`;
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(name);
  await page
    .getByLabel("Customer email", { exact: true })
    .fill(`alias-${crypto.randomUUID()}@example.com`);
  const savedResponse = page.waitForResponse(
    (response) =>
      response.url() === `${origin.origin}/api/v1/customers` &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Save customer", exact: true }).click();
  const saved = await savedResponse;
  expect(saved.status()).toBe(200);
  expect((await saved.request().allHeaders()).origin).toBe(origin.origin);
  expect(((await saved.json()) as { name: string }).name).toBe(name);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto(`${origin.origin}/inventory`);
  await expect(page.getByText("Live stock", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(`${origin.origin}/login`);
});
