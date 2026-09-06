import { expect, test } from "@playwright/test";

test("customer switching updates hardware tier pricing and approval limits", async ({
  page,
  baseURL,
}) => {
  const password = Bun.env.DEMO_PASSWORD ?? Bun.env.PLAYWRIGHT_USER_PASSWORD;
  if (!password) throw new Error("Seeded demo password required");
  expect(
    (
      await page.request.post("/api/auth/sign-in/email", {
        data: { email: "manager@dealflow360.demo", password },
      })
    ).ok(),
  ).toBe(true);
  const names = { Gold: `Gold ${crypto.randomUUID()}`, Silver: `Silver ${crypto.randomUUID()}` };
  for (const tier of ["Gold", "Silver"] as const) {
    const response = await page.request.post("/api/v1/customers", {
      headers: { origin: new URL(baseURL!).origin },
      data: { name: names[tier], email: `${crypto.randomUUID()}@example.com`, tier },
    });
    expect(response.ok()).toBe(true);
  }
  expect(
    (
      await page.request.post("/api/auth/sign-in/email", {
        data: { email: "rep@dealflow360.demo", password },
        headers: { origin: new URL(baseURL!).origin },
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/quotations/new");
  await page.getByRole("combobox", { name: "Customer", exact: true }).click();
  await page.getByRole("option", { name: `${names.Gold} · Gold`, exact: true }).click();
  await expect(page.getByRole("note")).toContainText("Gold tier: up to 15%");
  await expect(page.getByRole("note")).toContainText("Hardware tier pricing: 10%");
  await page.getByRole("combobox", { name: "Product to add", exact: true }).click();
  await page.getByRole("option", { name: /^Laptop Pro 14 ·/ }).click();
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await page.getByLabel("Laptop Pro 14 discount", { exact: true }).fill("12");
  await expect(page.getByText("Ceiling 15%", { exact: true })).toBeVisible();
  await expect(page.getByText("Within policy · automatic approval", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Customer", exact: true }).click();
  await page.getByRole("option", { name: `${names.Silver} · Silver`, exact: true }).click();
  await expect(page.getByRole("note")).toContainText("Silver tier: up to 10%");
  await expect(page.getByRole("note")).toContainText("Hardware tier pricing: 5%");
  await expect(page.getByText("Ceiling 10%", { exact: true })).toBeVisible();
  await expect(page.getByText("MEDIUM", { exact: true })).toBeVisible();
});

test("rep reads customers; manager creates, edits tier and protects the linked login", async ({
  browser,
  baseURL,
}) => {
  const password = Bun.env.DEMO_PASSWORD ?? Bun.env.PLAYWRIGHT_USER_PASSWORD;
  if (!password) throw new Error("Seeded demo password required");
  const rep = await browser.newContext({ baseURL });
  const manager = await browser.newContext({ baseURL });
  try {
    for (const [context, email] of [
      [rep, "rep@dealflow360.demo"],
      [manager, "manager@dealflow360.demo"],
    ] as const) {
      expect(
        (await context.request.post("/api/auth/sign-in/email", { data: { email, password } })).ok(),
      ).toBe(true);
    }
    const page = await rep.newPage();
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Customers", exact: true }).click();
    await expect(page.getByRole("button", { name: "Add customer", exact: true })).toHaveCount(0);
    const staff = await manager.newPage();
    await staff.goto("/customers");
    await staff.getByRole("button", { name: "Add customer", exact: true }).click();
    const name = `Customer browser ${crypto.randomUUID()}`;
    await staff.getByRole("textbox", { name: "Name", exact: true }).fill(name);
    await staff
      .getByLabel("Customer email", { exact: true })
      .fill(`customer-${crypto.randomUUID()}@example.com`);
    await staff.getByRole("button", { name: "Save customer", exact: true }).click();
    await expect(staff.getByRole("dialog")).toHaveCount(0);
    await page.reload();
    await page.getByPlaceholder("Search customers…").fill(name);
    await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit customer", exact: true })).toHaveCount(0);
    await staff.getByPlaceholder("Search customers…").fill(name);
    await staff.getByRole("button", { name: "Edit customer", exact: true }).click();
    await staff.getByLabel("Tier", { exact: true }).click();
    await staff.getByRole("option", { name: "Silver", exact: true }).click();
    await staff.getByRole("button", { name: "Save customer", exact: true }).click();
    await expect(staff.getByRole("dialog")).toHaveCount(0);
    await expect(staff.getByRole("row").filter({ hasText: name })).toContainText("Silver");
    await staff.getByRole("button", { name: "Edit customer", exact: true }).click();
    await staff.getByRole("button", { name: "Delete customer", exact: true }).click();
    await staff.getByRole("button", { name: "Confirm deletion", exact: true }).click();
    await expect(staff.getByRole("alert")).toContainText("linked portal account");
  } finally {
    await rep.close();
    await manager.close();
  }
});
