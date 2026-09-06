import { expect, test } from "@playwright/test";

test("quotation totals update by billing period, quantity and discount @regression", async ({
  page,
}) => {
  const password = Bun.env.DEMO_PASSWORD ?? Bun.env.PLAYWRIGHT_USER_PASSWORD;
  if (!password) throw new Error("Seeded demo password is required");
  const login = await page.request.post("/api/auth/sign-in/email", {
    data: { email: "rep@dealflow360.demo", password },
  });
  expect(login.ok()).toBe(true);
  await page.goto("/quotations/new");
  const summary = page.getByRole("region", { name: "Quotation totals", exact: true });
  await expect(summary).toContainText("Add valid quotation lines");
  async function add(name: string) {
    await page.getByRole("combobox", { name: "Product to add", exact: true }).click();
    await page.getByRole("option", { name: new RegExp(`^${name} ·`) }).click();
    await page.getByRole("button", { name: "Add product", exact: true }).click();
  }
  await add("Care Plan 1yr");
  await add("Care Plan Annual");
  await page.getByLabel("Care Plan 1yr discount", { exact: true }).fill("2");
  await page.getByLabel("Care Plan Annual discount", { exact: true }).fill("2");
  await page.getByLabel("Order discount %", { exact: true }).fill("2");
  const monthly = summary.getByRole("region", { name: "Monthly charges", exact: true });
  const annual = summary.getByRole("region", { name: "Annual charges", exact: true });
  await expect(summary).toContainText("No one-time charges");
  await expect(monthly).toContainText("₹26.89");
  await expect(annual).toContainText("₹384.16");
  await expect(annual).toContainText("₹15.84");
  await page.getByLabel("Care Plan Annual quantity", { exact: true }).fill("2");
  await expect(annual).toContainText("₹768.32");
  await expect(annual).toContainText("₹31.68");
  await page.getByLabel("Care Plan Annual discount", { exact: true }).fill("10");
  await expect(annual).toContainText("₹705.60");
  await expect(annual).toContainText("₹94.40");
  await expect(monthly).toContainText("₹26.89");
  await add("Onsite Setup Service");
  await expect(
    summary.getByRole("region", { name: "One-time charges", exact: true }),
  ).toBeVisible();
  await expect(summary).not.toContainText("No one-time charges");
  await page.getByLabel("Order discount %", { exact: true }).fill("101");
  await expect(summary).toContainText("Add valid quotation lines");
  await expect(summary).not.toContainText("₹0.00");
  await expect(page.getByRole("button", { name: "Save draft", exact: true })).toBeDisabled();
  await page.getByLabel("Order discount %", { exact: true }).fill("2");
  await expect(annual).toContainText("₹705.60");
  await page.getByRole("button", { name: "Remove Care Plan Annual", exact: true }).click();
  await expect(annual).toHaveCount(0);
  await expect(monthly).toContainText("₹26.89");
});
