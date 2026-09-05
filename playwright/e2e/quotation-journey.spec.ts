import { type Browser, expect, type Page, test } from "@playwright/test";

import type { Workspace } from "@/lib/domain/_types/workspace";

async function rolePage(browser: Browser, email: string, baseURL: string) {
  const password = Bun.env.DEMO_PASSWORD ?? Bun.env.PLAYWRIGHT_USER_PASSWORD;
  if (!password) throw new Error("Quotation journey requires seeded demo credentials");
  const context = await browser.newContext({ baseURL });
  const response = await context.request.post("/api/auth/sign-in/email", {
    data: { email, password },
  });
  expect(response.ok()).toBe(true);
  return { context, page: await context.newPage() };
}

async function addProduct(page: Page, name: string, quantity: string, discount: string) {
  await page.getByRole("combobox", { name: "Product to add", exact: true }).click();
  await page.getByRole("option", { name: new RegExp(`^${name} ·`) }).click();
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await page.getByLabel(`${name} quantity`, { exact: true }).fill(quantity);
  await page.getByLabel(`${name} discount`, { exact: true }).fill(discount);
}

async function approve(page: Page, quoteId: string, reason: string) {
  await page.goto(`/quotations/${quoteId}`);
  await page.getByLabel("Decision reason", { exact: true }).fill(reason);
  const response = page.waitForResponse(
    (result) =>
      result.url().endsWith(`/quotes/${quoteId}/approval`) && result.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  expect((await response).ok()).toBe(true);
  await expect(page.getByText("Quotation updated.", { exact: true })).toBeVisible();
}

test("hero quotation: builder, upsell, sequential approvals, customer counter and atomic order @regression", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(90000);
  if (!baseURL) throw new Error("Browser base URL is required");
  const rep = await rolePage(browser, "rep@dealflow360.demo", baseURL);
  const manager = await rolePage(browser, "manager@dealflow360.demo", baseURL);
  const finance = await rolePage(browser, "finance@dealflow360.demo", baseURL);
  const customer = await rolePage(browser, "acme@dealflow360.demo", baseURL);
  const admin = await rolePage(browser, "admin@dealflow360.demo", baseURL);
  try {
    await rep.page.goto("/quotations/new");
    await rep.page.getByRole("combobox", { name: "Customer", exact: true }).click();
    await rep.page.getByRole("option", { name: "Acme Corporation · Gold", exact: true }).click();
    await addProduct(rep.page, "Laptop Pro 14", "24", "12");
    await addProduct(rep.page, "Onsite Setup Service", "1", "18");
    await addProduct(rep.page, "Extended Warranty", "1", "10");
    await rep.page.getByRole("button", { name: "Add Care Plan 2yr to quote", exact: true }).click();
    await expect(rep.page.getByText("HIGH", { exact: true })).toBeVisible();
    await expect(rep.page.getByText("$26,815.14", { exact: true })).toBeVisible();
    await rep.page
      .getByLabel("Internal justification")
      .fill("Hackathon hero fixture: multi-site equipment and recurring care.");
    const createdResponse = rep.page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/v1/quotes") && response.request().method() === "POST",
    );
    await rep.page.getByRole("button", { name: "Save and submit", exact: true }).click();
    const response = await createdResponse;
    expect(response.ok()).toBe(true);
    const quote = (await response.json()) as { id: string; number: string };
    await expect(rep.page).toHaveURL(new RegExp(`/quotations/${quote.id}$`));
    await expect(rep.page.getByText("Waiting for Sales Manager.", { exact: true })).toBeVisible();
    await approve(manager.page, quote.id, "Manager reviewed the strategic volume discount.");
    await expect(manager.page.getByText("Waiting for Finance.", { exact: true })).toBeVisible();
    await approve(finance.page, quote.id, "Finance approved the documented commercial exception.");
    await expect(
      finance.page.getByText("This revision is approved. Customer confirmation may proceed.", {
        exact: true,
      }),
    ).toBeVisible();

    await customer.page.goto(`/portal/${quote.id}`);
    await expect(
      customer.page.getByRole("button", { name: "Confirm order", exact: true }),
    ).toBeVisible();
    await customer.page.getByLabel("Extended Warranty · discount (%)", { exact: true }).fill("15");
    const counterResponse = customer.page.waitForResponse(
      (result) =>
        result.url().endsWith(`/portal/${quote.id}/counter`) &&
        result.request().method() === "POST",
    );
    await customer.page.getByRole("button", { name: "Request changes", exact: true }).click();
    expect((await counterResponse).ok()).toBe(true);
    await expect(
      customer.page.getByRole("button", { name: "Confirm order", exact: true }),
    ).toHaveCount(0);
    await expect(customer.page.getByText("$26,805.24", { exact: true })).toBeVisible();
    await approve(manager.page, quote.id, "Manager approved the revised warranty terms.");
    await approve(
      finance.page,
      quote.id,
      "Finance reapproved the complete revised commercial terms.",
    );
    await customer.page.reload();
    await customer.page.getByRole("button", { name: "Confirm order", exact: true }).click();
    await expect(customer.page.getByRole("alertdialog")).toContainText("$26,805.24");
    await expect(customer.page.getByRole("alertdialog")).toContainText("$46.00 monthly");
    await customer.page.getByRole("button", { name: "Confirm this order", exact: true }).click();
    await expect(customer.page.getByText("Order confirmed", { exact: true })).toBeVisible();

    const workspaceResponse = await admin.context.request.get("/api/v1/workspace");
    expect(workspaceResponse.ok()).toBe(true);
    const workspace = (await workspaceResponse.json()) as Workspace;
    const order = workspace.orders.find((entry) => entry.quoteId === quote.id);
    expect(order).toBeDefined();
    const invoices = workspace.invoices.filter((invoice) => invoice.orderId === order!.id);
    expect(invoices).toHaveLength(2);
    expect(invoices.find((invoice) => invoice.kind === "ONE_TIME")?.totalCents).toBe(2680524);
    expect(invoices.find((invoice) => invoice.kind === "RECURRING")?.totalCents).toBe(4600);
    const reservations = workspace.reservations.filter(
      (reservation) => reservation.orderId === order!.id,
    );
    expect(
      reservations
        .map((reservation) => ({
          warehouseId: reservation.warehouseId,
          quantity: reservation.quantity,
        }))
        .sort((a, b) => a.warehouseId.localeCompare(b.warehouseId)),
    ).toEqual([
      { warehouseId: "east", quantity: 2 },
      { warehouseId: "main", quantity: 22 },
    ]);
    expect(
      workspace.subscriptions.filter((subscription) => subscription.orderId === order!.id),
    ).toHaveLength(1);
  } finally {
    await Promise.all([rep, manager, finance, customer, admin].map((role) => role.context.close()));
  }
});
