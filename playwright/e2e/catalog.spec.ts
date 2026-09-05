import { expect, test } from "@playwright/test";

test("admin creates and edits a product through the searchable catalog", async ({ page }) => {
  const password = Bun.env.DEMO_PASSWORD ?? Bun.env.PLAYWRIGHT_USER_PASSWORD;
  if (!password) throw new Error("Catalog browser tests require the seeded demo password");
  const login = await page.request.post("/api/auth/sign-in/email", {
    data: { email: "admin@dealflow360.demo", password },
  });
  expect(login.ok()).toBe(true);
  const initialWorkspace = await page.request.get("/api/v1/workspace");
  expect(initialWorkspace.ok()).toBe(true);
  const { products } = (await initialWorkspace.json()) as {
    products: { id: string; name: string; variant: string }[];
  };
  const pairing = products.find((product) => product.name === "Wireless Mouse");
  expect(pairing).toBeDefined();
  const pairingLabel = `${pairing!.name} · ${pairing!.variant}`;
  await page.goto("/catalog");
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  const name = `Catalog browser ${crypto.randomUUID()}`;
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(name);
  await page.getByLabel("Category", { exact: true }).click();
  await page.getByRole("option", { name: "Services", exact: true }).click();
  await page.getByLabel("Unit price (₹)", { exact: true }).fill("125");
  await page.getByLabel("Unit cost (₹)", { exact: true }).fill("50");
  await page.getByLabel("Tax (%)", { exact: true }).fill("10");
  await page.getByRole("checkbox", { name: pairingLabel, exact: true }).check();
  const createResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/catalog/products") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  const created = await createResponse;
  expect(created.ok()).toBe(true);
  const product = (await created.json()) as {
    id: string;
    pairedProductIds: string[];
    priceCents: number;
    taxBps: number;
  };
  expect(product.priceCents).toBe(12500);
  expect(product.taxBps).toBe(1000);
  expect(product.pairedProductIds).toEqual([pairing!.id]);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByPlaceholder("Search products…", { exact: true }).fill(name);
  await page.getByRole("row").filter({ hasText: name }).click();
  await expect(page.getByRole("checkbox", { name: pairingLabel, exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: `${name} · Standard`, exact: true })).toHaveCount(
    0,
  );
  await page.getByLabel("Unit price (₹)", { exact: true }).fill("150");
  const updateResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/v1/catalog/products/${product.id}`) &&
      response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  expect((await updateResponse).ok()).toBe(true);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("row").filter({ hasText: name })).toContainText("₹150.00");
});
