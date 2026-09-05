import { expect, test } from "@playwright/test";

test("quotation numeric editing preserves decimals and four-digit quantities @regression", async ({
  page,
}) => {
  const password = Bun.env.DEMO_PASSWORD ?? Bun.env.PLAYWRIGHT_USER_PASSWORD;
  if (!password) throw new Error("Seeded demo password is required");
  const login = await page.request.post("/api/auth/sign-in/email", {
    data: { email: "rep@dealflow360.demo", password },
  });
  expect(login.ok()).toBe(true);
  const initialWorkspace = await page.request.get("/api/v1/workspace");
  expect(initialWorkspace.ok()).toBe(true);
  const initialData = (await initialWorkspace.json()) as {
    customers: { name: string; tier: string }[];
    products: { name: string; active: boolean }[];
  };
  await page.goto("/quotations/new");
  await expect(page.getByRole("combobox", { name: "Customer", exact: true })).toContainText(
    `${initialData.customers[0]!.name} · ${initialData.customers[0]!.tier}`,
  );
  await expect(page.getByRole("combobox", { name: "Product to add", exact: true })).toContainText(
    initialData.products[0]!.name,
  );
  await page.getByRole("combobox", { name: "Product to add", exact: true }).click();
  await page.getByRole("option", { name: /^Laptop Pro 14 ·/ }).click();
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  const discount = page.getByLabel("Order discount %", { exact: true });
  await discount.click();
  await discount.pressSequentially("12.5");
  await expect(discount).toHaveValue("12.5");
  await discount.press("Tab");
  await expect(discount).toHaveValue("12.5");
  await discount.fill("");
  await expect(discount).toHaveValue("");
  await discount.pressSequentially("0.05");
  await discount.press("Tab");
  await expect(discount).toHaveValue("0.05");
  await discount.fill("0012");
  await expect(discount).toHaveValue("12");
  const quantity = page.getByLabel("Laptop Pro 14 quantity", { exact: true });
  await quantity.fill("");
  await quantity.pressSequentially("1234");
  await quantity.press("Tab");
  await expect(quantity).toHaveValue("1234");
  await expect(page.getByRole("button", { name: "Save draft", exact: true })).toBeEnabled();
  await quantity.fill("10001");
  await expect(
    page.getByText("Quantity must be an integer from 1 to 10,000", { exact: true }),
  ).toBeVisible();
  await quantity.fill("1234");
  await discount.fill("1234");
  await expect(
    page.getByText("Order discount must be between 0% and 100%", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Save draft", exact: true })).toBeDisabled();
  await discount.fill("12.5");
  await expect(page.getByRole("button", { name: "Save draft", exact: true })).toBeEnabled();
  const workspace = await page.request.get("/api/v1/workspace");
  expect(workspace.ok()).toBe(true);
  await expect(page.getByText("Unable to load your workspace", { exact: true })).toHaveCount(0);
});
