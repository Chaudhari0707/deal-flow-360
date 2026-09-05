import { expect, test } from "@playwright/test";

import type { Workspace } from "@/lib/domain/_types/workspace";

function demoPassword() {
  const password = Bun.env.DEMO_PASSWORD ?? Bun.env.PLAYWRIGHT_USER_PASSWORD;
  if (!password) throw new Error("Billing browser tests require seeded demo credentials");
  return password;
}

test("finance records a full payment, downloads real documents and cancels recurring service @regression", async ({
  page,
  request,
}) => {
  const password = demoPassword();
  const adminSignIn = await request.post("/api/auth/sign-in/email", {
    data: { email: "admin@dealflow360.demo", password },
  });
  expect(adminSignIn.ok()).toBe(true);
  const created = await request.post("/api/v1/quotes", {
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
  const submitted = await request.post(`/api/v1/quotes/${quote.id}/submit`, {
    data: { revision: quote.revision },
  });
  expect(submitted.ok()).toBe(true);
  const approved = (await submitted.json()) as { revision: number };
  const confirmed = await request.post(`/api/v1/quotes/${quote.id}/confirm`, {
    data: { revision: approved.revision },
  });
  expect(confirmed.ok()).toBe(true);
  const order = (await confirmed.json()) as { id: string; number: string };
  const initialResponse = await request.get("/api/v1/workspace");
  expect(initialResponse.ok()).toBe(true);
  const initial = (await initialResponse.json()) as Workspace;
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
  await expect(page.getByRole("heading", { name: "Invoices", exact: true })).toBeVisible();
  await page.getByLabel("Payment reference").fill(`BANK-${crypto.randomUUID()}`);
  await page.getByRole("button", { name: /Record full payment/ }).click();
  await expect(
    page.getByText("Payment recorded and balance reconciled.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Record full payment/ })).toHaveCount(0);
  const invoiceDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download invoice PDF" }).click();
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
  await page.getByLabel("Quantity", { exact: true }).fill("2");
  await page.getByLabel("Reason", { exact: true }).fill("Customer adds a second service unit");
  await page.getByRole("button", { name: "Apply change", exact: true }).click();
  await expect(
    page.getByText(
      "Subscription updated. Any prorated invoice or credit is in the invoice register.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByLabel("Reason", { exact: true }).fill("Customer cancels the recurring plan");
  await page.getByRole("button", { name: "Cancel and credit unused service", exact: true }).click();
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
  const excelDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download report Excel" }).click();
  const excel = await excelDownload;
  expect(excel.suggestedFilename()).toBe("dealflow-report.xlsx");
  const excelPath = await excel.path();
  expect(
    new TextDecoder().decode(new Uint8Array(await Bun.file(excelPath!).arrayBuffer()).slice(0, 2)),
  ).toBe("PK");
  const reportDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download report PDF" }).click();
  expect((await reportDownload).suggestedFilename()).toBe("dealflow-report.pdf");
});
