import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";

import type { ReportRow } from "@/features/billing/_types/documents";
import type { SalesReport } from "@/features/billing/_types/reports";
import type { Workspace } from "@/lib/domain/_types/workspace";

const reportPath = "/api/v1/reports/financial";
const rupees = (cents: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(cents / 100);

for (const role of ["manager", "finance", "admin", "rep", "ops", "customer"]) {
  test(`${role} report access, filters, totals and exports through real login @regression`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const password = Bun.env.DEMO_PASSWORD ?? Bun.env.PLAYWRIGHT_USER_PASSWORD;
    if (!password) throw new Error("Seeded demo credentials required");
    await page.goto("/login");
    await page
      .getByLabel("Email address")
      .fill(`${role === "customer" ? "acme" : role}@dealflow360.demo`);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(role === "customer" ? /\/portal$/ : /\/dashboard$/);
    const allowed = ["manager", "finance", "admin"].includes(role);
    if (!allowed) {
      await expect(page.getByRole("link", { name: "Reports", exact: true })).toHaveCount(0);
      for (const suffix of ["", "?format=pdf", "?format=xlsx"]) {
        const denied = await page.request.get(reportPath + suffix);
        expect(denied.status()).toBe(403);
        expect(await denied.json()).toEqual({ error: "Your role cannot perform this action." });
      }
      await page.goto("/reports");
      if (role === "customer") await expect(page).toHaveURL(/\/portal$/);
      else await expect(page.getByRole("heading", { name: "403 — Access denied" })).toBeVisible();
      return;
    }
    const workspaceResponse = await page.request.get("/api/v1/workspace");
    expect(workspaceResponse.ok()).toBe(true);
    const workspace = (await workspaceResponse.json()) as Workspace;
    const initialResponse = await page.request.get(reportPath);
    expect(initialResponse.ok()).toBe(true);
    const initial = (await initialResponse.json()) as {
      rows: ReportRow[];
      sales: SalesReport;
      totals: { billedCents: number; paidCents: number; outstandingCents: number };
      options: { representatives: { id: string; name: string }[]; teams: string[] };
    };
    // Independent check against the persisted workspace records, not the report calculation.
    expect(initial.totals).toEqual({
      billedCents:
        workspace.invoices.reduce((sum, invoice) => sum + invoice.totalCents, 0) -
        workspace.credits.reduce((sum, credit) => sum + credit.amountCents, 0),
      paidCents: workspace.invoices.reduce((sum, invoice) => sum + invoice.paidCents, 0),
      outstandingCents: workspace.invoices.reduce(
        (sum, invoice) =>
          sum + Math.max(0, invoice.totalCents - invoice.paidCents - invoice.creditedCents),
        0,
      ),
    });
    expect(initial.sales.metrics.quotesCreated).toBe(workspace.quotes.length);
    expect(initial.sales.metrics.ordersConfirmed).toBe(workspace.orders.length);
    await page.getByRole("link", { name: "Reports", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Reports", exact: true })).toBeVisible();
    for (const [label, value] of [
      ["Net billed", rupees(initial.totals.billedCents)],
      ["Payments collected", rupees(initial.totals.paidCents)],
      ["Outstanding", rupees(initial.totals.outstandingCents)],
      ["Quotes created", String(initial.sales.metrics.quotesCreated)],
      ["Orders confirmed", String(initial.sales.metrics.ordersConfirmed)],
    ]) {
      await expect(
        page
          .locator('[data-slot="card"]')
          .filter({
            has: page.getByText(label!, { exact: true }),
          })
          .getByText(value!, { exact: true }),
      ).toBeVisible();
    }

    const customer = workspace.customers.find((entry) => entry.id === "acme")!;
    const rep = initial.options.representatives[0]!;
    const product = workspace.products.find((entry) => entry.id === "care2")!;
    const filters = [
      {
        label: "customer",
        option: customer.name,
        key: "customerId",
        value: customer.id,
        reset: "All customers",
      },
      {
        label: "category",
        option: product.category,
        key: "category",
        value: product.category,
        reset: "All categories",
      },
      { label: "status", option: "Paid", key: "status", value: "PAID", reset: "All statuses" },
      { label: "representative", option: rep.name, key: "repId", value: rep.id, reset: "All" },
      { label: "team", option: customer.team, key: "team", value: customer.team, reset: "All" },
      {
        label: "approval status",
        option: "Approved current terms",
        key: "approvalStatus",
        value: "APPROVED",
        reset: "All",
      },
      { label: "product", option: product.name, key: "productId", value: product.id, reset: "All" },
    ];
    for (const filter of filters) {
      await page.getByRole("combobox", { name: `Report ${filter.label}`, exact: true }).click();
      const responsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(reportPath + "?") &&
          new URL(response.url()).searchParams.get(filter.key) === filter.value,
      );
      await page.getByRole("option", { name: filter.option, exact: true }).click();
      const response = await responsePromise;
      expect(response.ok()).toBe(true);
      const filtered = (await response.json()) as typeof initial;
      await expect(
        page.getByText(`${filtered.rows.length} financial records`, { exact: true }),
      ).toBeVisible();
      if (filter.key === "customerId") {
        expect(filtered.rows.every((row) => row.customer === customer.name)).toBe(true);
        expect(filtered.sales.quotes.every((row) => row.customer === customer.name)).toBe(true);
      }
      if (filter.key === "status") {
        expect(filtered.rows.every((row) => row.status === "PAID")).toBe(true);
        expect(filtered.sales.metrics).toEqual(initial.sales.metrics);
      }
      await page.getByRole("combobox", { name: `Report ${filter.label}`, exact: true }).click();
      await page.getByRole("option", { name: filter.reset, exact: true }).click();
      await expect(
        page.getByText(`${initial.rows.length} financial records`, { exact: true }),
      ).toBeVisible();
    }

    await page.getByLabel("From", { exact: true }).fill("2199-01-01");
    await page.getByLabel("To", { exact: true }).fill("2199-01-31");
    await expect(
      page.getByText("No sales records match these filters.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("No records match these filters.", { exact: true })).toBeVisible();
    await page.getByLabel("To", { exact: true }).fill("2198-12-31");
    await expect(
      page.getByText("Start date must be before the end date.", { exact: true }),
    ).toBeVisible();
    for (const format of ["PDF", "Excel"])
      await expect(page.getByRole("button", { name: `Download report ${format}` })).toBeDisabled();
    for (const format of ["", "&format=pdf", "&format=xlsx"]) {
      expect(
        (await page.request.get(`${reportPath}?from=2199-01-01&to=2198-12-31${format}`)).status(),
      ).toBe(400);
      expect((await page.request.get(`${reportPath}?from=not-a-date${format}`)).status()).toBe(400);
    }
    await page.getByLabel("From", { exact: true }).fill("");
    await page.getByLabel("To", { exact: true }).fill("");
    await expect(
      page.getByText(`${initial.rows.length} financial records`, { exact: true }),
    ).toBeVisible();
    for (const format of ["Excel", "PDF"]) {
      const event = page.waitForEvent("download");
      await page.getByRole("button", { name: `Download report ${format}`, exact: true }).click();
      const download = await event;
      expect(download.suggestedFilename()).toBe(
        format === "Excel" ? "dealflow-report.xlsx" : "dealflow-report.pdf",
      );
      const bytes = await Bun.file((await download.path())!).arrayBuffer();
      if (format === "Excel") {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(bytes);
        expect(workbook.getWorksheet("Financial report")!.rowCount).toBe(initial.rows.length + 1);
        expect(workbook.getWorksheet("Quotations")!.rowCount).toBe(initial.sales.quotes.length + 1);
        expect(workbook.getWorksheet("Orders")!.rowCount).toBe(initial.sales.orders.length + 1);
        expect(workbook.getWorksheet("Sales metrics")!.getCell("B2").value).toBe(
          initial.sales.metrics.quotesCreated,
        );
      } else expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(0);
    }

    // Expire the real session while the report remains cached, then change a filter.
    expect(
      (
        await page.request.post("/api/auth/sign-out", {
          headers: { origin: new URL(page.url()).origin },
          data: {},
        })
      ).ok(),
    ).toBe(true);
    await page.getByRole("combobox", { name: "Report status", exact: true }).click();
    const deniedRefresh = page.waitForResponse(
      (response) => response.url().includes(reportPath + "?") && response.status() === 401,
    );
    await page.getByRole("option", { name: "Unpaid", exact: true }).click();
    await deniedRefresh;
    await expect(page.getByText("Unable to load your workspace", { exact: true })).toBeVisible();
    await expect(page.getByText("Net billed", { exact: true })).toHaveCount(0);
    for (const format of ["PDF", "Excel"])
      await expect(page.getByRole("button", { name: `Download report ${format}` })).toBeDisabled();
  });
}

test("unauthenticated report JSON and exports never disclose data @regression", async ({
  request,
}) => {
  for (const suffix of ["", "?format=pdf", "?format=xlsx"])
    expect((await request.get(reportPath + suffix)).status()).toBe(401);
});
