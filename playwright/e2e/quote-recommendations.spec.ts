import { expect, type Page, test } from "@playwright/test";

async function addProduct(page: Page, name: string) {
  await page.getByRole("combobox", { name: "Product to add", exact: true }).click();
  await page.getByRole("option", { name: new RegExp(`^${name} ·`) }).click();
  await page.getByRole("button", { name: "Add product", exact: true }).click();
}

test("configured product upsells replace purchase-history recommendations @regression", async ({
  page,
}) => {
  const password = Bun.env.DEMO_PASSWORD ?? Bun.env.PLAYWRIGHT_USER_PASSWORD;
  if (!password) throw new Error("Seeded demo credentials required");
  const login = await page.request.post("/api/auth/sign-in/email", {
    data: { email: "rep@dealflow360.demo", password },
  });
  expect(login.ok()).toBe(true);

  await page.goto("/quotations/new");
  await expect(page.getByText("Upsell recommendations", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Add a product to see its configured upsell recommendations.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Best sellers", { exact: false })).toHaveCount(0);

  await addProduct(page, "Laptop Pro 14");
  await expect(
    page.getByRole("button", { name: "Add Care Plan 2yr recommendation to quote", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add Wireless Mouse recommendation to quote", exact: true }),
  ).toBeVisible();

  await addProduct(page, "Docking Station");
  const labels = await page
    .getByRole("button", { name: / recommendation to quote$/ })
    .allTextContents();
  expect(labels).toEqual([
    "Add Care Plan 2yr recommendation to quote",
    "Add Monitoring Add-on recommendation to quote",
    "Add Wireless Mouse recommendation to quote",
  ]);
  expect(labels).toHaveLength(3);

  await page
    .getByRole("button", { name: "Add Care Plan 2yr recommendation to quote", exact: true })
    .click();
  await expect(page.getByLabel("Care Plan 2yr quantity", { exact: true })).toHaveValue("1");

  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/quotes") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  const quote = (await (await saved).json()) as {
    lines: { productId: string; upsell?: boolean }[];
  };
  expect(quote.lines.find((line) => line.productId === "care2")?.upsell).toBe(true);
});
