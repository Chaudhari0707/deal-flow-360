import { expect, request as requestFactory, test } from "@playwright/test";

import type { Workspace } from "@/lib/domain/_types/workspace";

function demoPassword() {
  const password = Bun.env.DEMO_PASSWORD ?? Bun.env.PLAYWRIGHT_USER_PASSWORD;
  if (!password) throw new Error("Billing browser tests require seeded demo credentials");
  return password;
}

async function signedInRequest(baseURL: string, email: string, password: string) {
  const request = await requestFactory.newContext({ baseURL });
  const response = await request.post("/api/auth/sign-in/email", { data: { email, password } });
  expect(response.ok(), await response.text()).toBe(true);
  return request;
}

test("finance records a full payment, downloads real documents and cancels recurring service @regression", async ({
  baseURL,
  page,
}) => {
  if (!baseURL) throw new Error("Billing browser tests require the application base URL");
  const password = demoPassword();
  const repRequest = await signedInRequest(baseURL, "rep@dealflow360.demo", password);
  const created = await repRequest.post("/api/v1/quotes", {
    headers: { origin: new URL(baseURL!).origin },
    data: {
      customerId: "acme",
      lines: [
        { discountBps: 0, productId: "setup", quantity: 1 },
        { discountBps: 0, productId: "care2", quantity: 1 },
      ],
      notes: `Billing browser ${crypto.randomUUID()}`,
      orderDiscountBps: 0,
    },
  });
  expect(created.ok()).toBe(true);
  const quote = (await created.json()) as { id: string; revision: number };
  const submitted = await repRequest.post(`/api/v1/quotes/${quote.id}/submit`, {
    headers: { origin: new URL(baseURL!).origin },
    data: { revision: quote.revision },
  });
  expect(submitted.ok()).toBe(true);
  const approved = (await submitted.json()) as { revision: number };
  await repRequest.dispose();
  const customerRequest = await signedInRequest(baseURL, "acme@dealflow360.demo", password);
  const confirmed = await customerRequest.post(`/api/v1/portal/${quote.id}/confirm`, {
    headers: { origin: new URL(baseURL!).origin },
    data: { revision: approved.revision },
  });
  expect(confirmed.ok()).toBe(true);
  const order = (await confirmed.json()) as { id: string; number: string };
  await customerRequest.dispose();
  const adminRequest = await signedInRequest(baseURL, "admin@dealflow360.demo", password);
  const initialResponse = await adminRequest.get("/api/v1/workspace");
  expect(initialResponse.ok()).toBe(true);
  const initial = (await initialResponse.json()) as Workspace;
  await adminRequest.dispose();
  const quoteCreator = initial.activity.find(
    (entry) => entry.action === "QUOTE_CREATED" && entry.entityId === quote.id,
  );
  expect(quoteCreator).toBeDefined();
  const invoice = initial.invoices.find(
    (entry) => entry.orderId === order.id && entry.kind === "ONE_TIME",
  )!;
  expect(invoice).toBeDefined();

  await page.goto("/login");
  await page.getByLabel("Email address").fill("finance@dealflow360.demo");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto(`/invoices/${invoice.id}`);
  const invoiceDialog = page.getByRole("dialog", { name: invoice.number, exact: true });
  await expect(invoiceDialog).toBeVisible();
  await expect(invoiceDialog.locator("[data-slot='dialog-footer']")).toHaveCSS(
    "position",
    "sticky",
  );
  await invoiceDialog.getByLabel("Payment reference").fill(`BANK-${crypto.randomUUID()}`);
  await invoiceDialog.getByRole("button", { name: /Record full payment/ }).click();
  await expect(
    page.getByText("Payment recorded and balance reconciled.", { exact: true }),
  ).toBeVisible();
  await expect(invoiceDialog.getByRole("button", { name: /Record full payment/ })).toHaveCount(0);
  const invoiceDownload = page.waitForEvent("download");
  await invoiceDialog.getByRole("button", { name: "Download invoice PDF" }).click();
  const invoiceFile = await invoiceDownload;
  expect(invoiceFile.suggestedFilename()).toBe(`${invoice.number}.pdf`);
  const invoicePath = await invoiceFile.path();
  expect(
    new TextDecoder().decode(
      new Uint8Array(await Bun.file(invoicePath!).arrayBuffer()).slice(0, 5),
    ),
  ).toBe("%PDF-");

  await page.goto("/subscriptions");
  await page.getByRole("textbox", { name: "Search subscriptions" }).fill(order.number);
  await page.getByRole("row").filter({ hasText: order.number }).click();
  const subscriptionDialog = page.getByRole("dialog", { name: "Care Plan 2yr", exact: true });
  await expect(subscriptionDialog).toBeVisible();
  await expect(subscriptionDialog.locator("[data-slot='dialog-footer']")).toHaveCSS(
    "position",
    "sticky",
  );
  await subscriptionDialog.getByLabel("Quantity", { exact: true }).fill("2");
  await subscriptionDialog
    .getByLabel("Reason", { exact: true })
    .fill("Customer adds a second service unit");
  await subscriptionDialog.getByRole("button", { name: "Apply change", exact: true }).click();
  await expect(
    page.getByText(
      "Subscription updated. Any prorated invoice or credit is in the invoice register.",
      { exact: true },
    ),
  ).toBeVisible();
  await subscriptionDialog
    .getByLabel("Reason", { exact: true })
    .fill("Customer cancels the recurring plan");
  await subscriptionDialog
    .getByRole("button", { name: "Cancel and credit unused service", exact: true })
    .click();
  await expect(
    page.getByText(
      "Subscription cancelled. Unused service credit issued; future billing stopped.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      "This subscription is cancelled. Issued invoices and credits remain available.",
      { exact: true },
    ),
  ).toBeVisible();
  const persisted = (await (await page.request.get("/api/v1/workspace")).json()) as Workspace;
  expect(persisted.subscriptions.find((entry) => entry.orderId === order.id)?.status).toBe(
    "CANCELLED",
  );
  expect(persisted.payments.filter((entry) => entry.invoiceId === invoice.id)).toHaveLength(1);
  expect(
    persisted.credits.some(
      (entry) =>
        entry.subscriptionId ===
        initial.subscriptions.find((entry) => entry.orderId === order.id)?.id,
    ),
  ).toBe(true);

  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "Reports", exact: true })).toBeVisible();
  await expect(page.getByText("Quotes created", { exact: true })).toBeVisible();
  await expect(page.getByText("Quotations and confirmed orders", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Show filters", exact: true }).click();
  for (const filter of [
    {
      label: "Report representative",
      option: quoteCreator!.actorName,
      key: "repId",
      value: quoteCreator!.actorId!,
    },
    {
      label: "Report team",
      option: initial.customers.find((customer) => customer.id === "acme")!.team,
      key: "team",
      value: initial.customers.find((customer) => customer.id === "acme")!.team,
    },
    {
      label: "Report approval status",
      option: "Approved current terms",
      key: "approvalStatus",
      value: "APPROVED",
    },
    {
      label: "Report product",
      option: initial.products.find((product) => product.id === "care2")!.name,
      key: "productId",
      value: "care2",
    },
  ]) {
    await page.getByRole("combobox", { name: filter.label, exact: true }).click();
    const filteredResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/reports/financial?") &&
        new URL(response.url()).searchParams.get(filter.key) === filter.value,
    );
    await page.getByRole("option", { name: filter.option, exact: true }).click();
    const response = await filteredResponse;
    expect(response.ok()).toBe(true);
    const report = await response.json();
    expect(report.sales.quotes.some((entry: { id: string }) => entry.id === quote.id)).toBe(true);
  }
  await page.getByRole("tab", { name: "Financial report", exact: true }).click();
  const excelDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download financial report Excel", exact: true }).click();
  const excel = await excelDownload;
  expect(excel.suggestedFilename()).toBe("dealflow-report.xlsx");
  const excelPath = await excel.path();
  expect(
    new TextDecoder().decode(new Uint8Array(await Bun.file(excelPath!).arrayBuffer()).slice(0, 2)),
  ).toBe("PK");
  await page.getByRole("tab", { name: "Sales report", exact: true }).click();
  const reportDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download sales report PDF", exact: true }).click();
  expect((await reportDownload).suggestedFilename()).toBe("dealflow-report.pdf");
});
