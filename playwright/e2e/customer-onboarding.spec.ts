import { expect, test } from "@playwright/test";

test("customer creation emails a temporary login, requires password replacement and isolates the portal @regression", async ({
  browser,
  baseURL,
}) => {
  const demoPassword = Bun.env.DEMO_PASSWORD ?? Bun.env.PLAYWRIGHT_USER_PASSWORD;
  if (!demoPassword) throw new Error("Seeded password required");
  const manager = await browser.newContext({ baseURL });
  const customer = await browser.newContext({ baseURL });
  try {
    expect(
      (
        await manager.request.post("/api/auth/sign-in/email", {
          data: { email: "manager@dealflow360.demo", password: demoPassword },
        })
      ).ok(),
    ).toBe(true);
    const page = await manager.newPage();
    await page.goto("/customers");
    await page.getByRole("button", { name: "Add customer", exact: true }).click();
    const email = `onboarding-${crypto.randomUUID()}@example.com`;
    await page.getByRole("textbox", { name: "Name", exact: true }).fill("New portal customer");
    await page.getByLabel("Customer email", { exact: true }).fill(email);
    await page.getByRole("button", { name: "Save customer", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const response = await manager.request.get(
      `http://127.0.0.1:3103/messages?to=${encodeURIComponent(email)}`,
    );
    const messages = (await response.json()) as { to: string; subject: string; text: string }[];
    expect(messages.length).toBe(1);
    expect(messages[0]!.subject).toBe("Your DealFlow360 customer portal login");
    const temporaryPassword = messages[0]!.text.match(/Temporary password: (\S+)/)?.[1];
    if (!temporaryPassword) throw new Error("Provider did not receive a temporary password");
    const staffIdentity = await (await manager.request.get("/api/v1/me")).json();
    expect(staffIdentity.actor.role).toBe("manager");
    const portal = await customer.newPage();
    await portal.goto("/login");
    await portal.getByLabel("Email address").fill(email);
    await portal.getByLabel("Password", { exact: true }).fill(temporaryPassword);
    await portal.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(portal).toHaveURL(/\/change-password$/);
    expect((await customer.request.get("/api/v1/portal")).status()).toBe(403);
    const password = `Changed-${crypto.randomUUID()}`;
    await portal.getByLabel("Temporary password", { exact: true }).fill(temporaryPassword);
    await portal.getByLabel("New password", { exact: true }).fill(password);
    await portal.getByLabel("Confirm new password", { exact: true }).fill(password);
    await portal.getByRole("button", { name: "Update password", exact: true }).click();
    await expect(portal).toHaveURL(/\/portal$/);
    expect((await customer.request.get("/api/v1/portal")).status()).toBe(200);
    expect((await customer.request.get("/api/v1/workspace")).status()).toBe(403);
    await portal.goto("/dashboard");
    await expect(portal).toHaveURL(/\/portal$/);
    await portal.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(portal).toHaveURL(/\/login$/);
    expect(
      (
        await customer.request.post("/api/auth/sign-in/email", {
          data: { email, password: temporaryPassword },
        })
      ).ok(),
    ).toBe(false);
    await portal.getByLabel("Email address").fill(email);
    await portal.getByLabel("Password", { exact: true }).fill(password);
    await portal.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(portal).toHaveURL(/\/portal$/);
  } finally {
    await manager.close();
    await customer.close();
  }
});

test("welcome email failure keeps the saved customer and retries the same invitation @regression", async ({
  page,
}) => {
  const password = Bun.env.DEMO_PASSWORD ?? Bun.env.PLAYWRIGHT_USER_PASSWORD;
  if (!password) throw new Error("Seeded password required");
  expect(
    (
      await page.request.post("/api/auth/sign-in/email", {
        data: { email: "manager@dealflow360.demo", password },
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/customers");
  await page.getByRole("button", { name: "Add customer", exact: true }).click();
  const email = `retry-${crypto.randomUUID()}@example.com`;
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Retry customer");
  await page.getByLabel("Customer email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Save customer", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByPlaceholder("Search customers…").fill("Retry customer");
  const row = page.getByRole("row").filter({ hasText: "Retry customer" });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Edit customer", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry welcome email", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry welcome email", exact: true }).click();
  await expect(
    page.getByText("Welcome email accepted by provider.", { exact: true }),
  ).toBeVisible();
  const messages = await (
    await page.request.get(`http://127.0.0.1:3103/messages?to=${encodeURIComponent(email)}`)
  ).json();
  expect(messages.length).toBe(1);
  const workspace = await (await page.request.get("/api/v1/workspace")).json();
  expect(workspace.customers.filter((c: { email: string }) => c.email === email).length).toBe(1);
});

test("provider test-domain rejection shows configuration guidance without losing the customer @regression", async ({
  page,
}) => {
  const password = Bun.env.DEMO_PASSWORD ?? Bun.env.PLAYWRIGHT_USER_PASSWORD;
  if (!password) throw new Error("Seeded password required");
  expect(
    (
      await page.request.post("/api/auth/sign-in/email", {
        data: { email: "manager@dealflow360.demo", password },
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/customers");
  await page.getByRole("button", { name: "Add customer", exact: true }).click();
  const email = `restricted-${crypto.randomUUID()}@example.com`;
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Restricted sender customer");
  await page.getByLabel("Customer email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Save customer", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByPlaceholder("Search customers…").fill("Restricted sender customer");
  const row = page.getByRole("row").filter({ hasText: "Restricted sender customer" });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Edit customer", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/Retrying the same test sender will not fix this/)).toBeVisible();
  await expect(dialog.getByText(/private@example.test/)).toHaveCount(0);
  const workspace = await (await page.request.get("/api/v1/workspace")).json();
  expect(
    workspace.customers.filter((entry: { email: string }) => entry.email === email),
  ).toHaveLength(1);
});
