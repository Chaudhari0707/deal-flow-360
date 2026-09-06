import { expect, test } from "@playwright/test";

test("quotation delivery dates cannot be set in the past @regression", async ({ page }) => {
  const password = Bun.env.DEMO_PASSWORD ?? Bun.env.PLAYWRIGHT_USER_PASSWORD;
  if (!password) throw new Error("Seeded demo credentials required");
  const login = await page.request.post("/api/auth/sign-in/email", {
    data: { email: "rep@dealflow360.demo", password },
  });
  expect(login.ok()).toBe(true);

  await page.goto("/quotations/new");
  const promisedDate = page.getByLabel("Promised delivery", { exact: true });
  expect(await promisedDate.getAttribute("min")).toBe(new Date().toISOString().slice(0, 10));

  await page.getByRole("combobox", { name: "Product to add", exact: true }).click();
  await page.getByRole("option", { name: /^Laptop Pro 14 ·/ }).click();
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await promisedDate.fill("2000-01-01");

  await expect(
    page.getByText("Promised delivery date must be today or later", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Save draft", exact: true })).toBeDisabled();
});
