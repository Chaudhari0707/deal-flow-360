import { expect, test } from "@playwright/test";

test("customer reviews, discusses, counters and confirms their approved quotation @regression", async ({
  baseURL,
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const password = Bun.env.DEMO_PASSWORD ?? Bun.env.PLAYWRIGHT_USER_PASSWORD;
  if (!password) throw new Error("Portal browser tests require the seeded demo password");
  const signedIn = await request.post("/api/auth/sign-in/email", {
    data: { email: "rep@dealflow360.demo", password },
  });
  expect(signedIn.ok()).toBe(true);
  const created = await request.post("/api/v1/quotes", {
    headers: { origin: new URL(baseURL!).origin },
    data: {
      customerId: "acme",
      lines: [{ productId: "setup", quantity: 1, discountBps: 0 }],
      orderDiscountBps: 0,
      notes: `Portal browser fixture ${crypto.randomUUID()}`,
    },
  });
  expect(created.ok()).toBe(true);
  const quote = (await created.json()) as { id: string; number: string; revision: number };
  const submitted = await request.post(`/api/v1/quotes/${quote.id}/submit`, {
    headers: { origin: new URL(baseURL!).origin },
    data: { revision: quote.revision },
  });
  expect(submitted.ok()).toBe(true);

  await page.goto("/login");
  await page.getByLabel("Email address").fill("acme@dealflow360.demo");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/portal$/, { timeout: 15_000 });
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByRole("link", { name: "Quotations", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Overview", exact: true })).toHaveCount(0);
  await page.goto(`/portal/${quote.id}`);
  await expect(page.getByRole("heading", { name: quote.number, exact: true })).toBeVisible();
  await expect(page.getByText("Acme Corporation", { exact: false })).toBeVisible();

  await page.getByLabel("About", { exact: true }).click();
  await page.getByRole("option", { name: "Onsite Setup Service", exact: true }).click();
  const message = `Please confirm our implementation contact ${crypto.randomUUID()}`;
  await page.getByLabel("Your message").fill(message);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText(message, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm order", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email address").fill("rep@dealflow360.demo");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await page.goto("/portal");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("link", { name: "Customer portal", exact: true })).toHaveCount(0);
  await page.goto(`/quotations/${quote.id}`);
  await expect(page.getByRole("heading", { name: quote.number, exact: true })).toBeVisible();
  await expect(page.getByText(message, { exact: true })).toBeVisible();
  const reply = `Implementation contact is Jordan ${crypto.randomUUID()}`;
  await page.getByLabel("Your reply").fill(reply);
  await page.getByRole("button", { name: "Send reply", exact: true }).click();
  await expect(page.getByText(reply, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email address").fill("acme@dealflow360.demo");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/portal$/, { timeout: 15_000 });
  await page.goto(`/portal/${quote.id}`);
  await expect(page.getByText(reply, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm order", exact: true })).toBeVisible();

  await page.getByLabel("Onsite Setup Service · discount (%)", { exact: true }).fill("5");
  const counterResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/portal/${quote.id}/counter`) &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Request changes", exact: true }).click();
  const response = await counterResponse;
  expect(response.ok()).toBe(true);
  const counter = (await response.json()) as { revision: number };
  await expect(page.getByText(new RegExp(`Version ${counter.revision} ·`))).toBeVisible();
  await page.getByRole("button", { name: "Confirm order", exact: true }).click();
  const confirmation = page.getByRole("alertdialog");
  await expect(confirmation).toBeVisible();
  await expect(confirmation.locator("[data-slot='alert-dialog-footer']")).toHaveCSS(
    "position",
    "sticky",
  );
  await confirmation.getByRole("button", { name: "Confirm this order", exact: true }).click();
  await expect(page.getByText("Order confirmed", { exact: true })).toBeVisible();
  const saved = await request.get(`/api/v1/quotes/${quote.id}`);
  expect(((await saved.json()) as { quote: { status: string } }).quote.status).toBe("CONFIRMED");
});
