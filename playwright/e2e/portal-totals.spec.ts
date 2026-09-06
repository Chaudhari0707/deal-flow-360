import { expect, test } from "@playwright/test";

test("customer reviews saved discounts, negotiates and confirms matching billing-period totals @regression", async ({
  page,
  request,
  baseURL,
}) => {
  const password = Bun.env.DEMO_PASSWORD ?? Bun.env.PLAYWRIGHT_USER_PASSWORD;
  if (!password || !baseURL) throw new Error("Seeded demo credentials required");
  const headers = { origin: new URL(baseURL).origin };
  expect(
    (
      await request.post("/api/auth/sign-in/email", {
        data: { email: "rep@dealflow360.demo", password },
      })
    ).ok(),
  ).toBe(true);
  const created = await request.post("/api/v1/quotes", {
    headers,
    data: {
      customerId: "acme",
      lines: ["care1", "care3", "setup"].map((productId) => ({
        productId,
        quantity: 1,
        discountBps: 200,
      })),
      orderDiscountBps: 200,
    },
  });
  expect(created.ok()).toBe(true);
  const quote = (await created.json()) as { id: string; revision: number; number: string };
  expect(
    (
      await request.post(`/api/v1/quotes/${quote.id}/submit`, {
        headers,
        data: { revision: quote.revision },
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await page.request.post("/api/auth/sign-in/email", {
        data: { email: "acme@dealflow360.demo", password },
      })
    ).ok(),
  ).toBe(true);
  await page.goto(`/portal/${quote.id}`);
  const summary = page.getByRole("region", { name: "Quotation price breakdown", exact: true });
  await expect(summary.getByRole("region", { name: "Monthly charges", exact: true })).toContainText(
    "₹26.89",
  );
  await expect(summary.getByRole("region", { name: "Annual charges", exact: true })).toContainText(
    "₹15.84",
  );
  await expect(summary.getByRole("region", { name: "Annual charges", exact: true })).toContainText(
    "₹384.16",
  );
  const once = summary.getByRole("region", { name: "One-time charges", exact: true });
  for (const amount of ["₹17.82", "₹432.18", "₹43.22", "₹475.40"])
    await expect(once).toContainText(amount);
  const line = page.getByRole("row").filter({ hasText: "Care Plan Annual" });
  await expect(line).toContainText("₹15.84");
  await expect(line).toContainText("₹384.16");
  await expect(page.getByText(/margin/i)).toHaveCount(0);

  await page.getByLabel("Care Plan 1yr · discount (%)", { exact: true }).fill("5");
  const counter = page.waitForResponse(
    (r) => r.url().endsWith(`/portal/${quote.id}/counter`) && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Request changes", exact: true }).click();
  expect((await counter).ok()).toBe(true);
  await expect(summary.getByRole("region", { name: "Monthly charges", exact: true })).toContainText(
    "₹26.07",
  );
  await expect(summary.getByRole("region", { name: "Monthly charges", exact: true })).toContainText(
    "₹1.93",
  );
  const pageTotals = await summary.innerText();
  await page.getByRole("button", { name: "Confirm order", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(
    dialog.getByRole("region", { name: "Quotation price breakdown", exact: true }),
  ).toHaveText(pageTotals, { useInnerText: true });
  const annualTotal = dialog
    .getByRole("region", { name: "Annual charges", exact: true })
    .getByText("₹384.16", { exact: true })
    .last();
  await annualTotal.scrollIntoViewIfNeeded();
  await expect(annualTotal).toBeInViewport();
  await dialog.getByRole("button", { name: "Confirm this order", exact: true }).click();
  await expect(page.getByText("Order confirmed", { exact: true })).toBeVisible();
  const saved = await request.get(`/api/v1/quotes/${quote.id}`);
  expect((await saved.json()).quote.status).toBe("CONFIRMED");
});
