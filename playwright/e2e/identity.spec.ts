import { expect, test } from "@playwright/test";

test("credentials sign-in, responsive navigation and logout @regression", async ({ page }) => {
  const email = Bun.env.PLAYWRIGHT_USER_EMAIL ?? "rep@dealflow360.demo";
  const password = Bun.env.PLAYWRIGHT_USER_PASSWORD ?? Bun.env.DEMO_PASSWORD;
  if (!email || !password)
    throw new Error("Browser identity tests require seeded test credentials");

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  const reviewerAccount = page.getByRole("combobox", { name: "Reviewer account", exact: true });
  await reviewerAccount.click();
  await page.getByRole("option", { name: "Sales Representative", exact: true }).click();
  await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(
    "rep@dealflow360.demo",
  );
  const passwordInput = page.getByLabel("Password", { exact: true });
  if (Bun.env.NEXT_PUBLIC_REVIEWER_PASSWORD)
    await expect(passwordInput).toHaveValue(Bun.env.NEXT_PUBLIC_REVIEWER_PASSWORD);
  await expect(passwordInput).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show password", exact: true }).click();
  await expect(passwordInput).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password", exact: true }).click();
  await expect(passwordInput).toHaveAttribute("type", "password");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("incorrect-password-for-test");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Customer portal", exact: true })).toHaveCount(0);
  await page.goto("/portal");
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await expect(page.getByRole("link", { name: "Quotations", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("signup creates a sales account and opens its workspace", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Browser Test Customer");
  await page.getByLabel("Email address").fill(`browser-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill(`Test-${crypto.randomUUID()}`);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
});
