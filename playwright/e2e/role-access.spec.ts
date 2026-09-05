import { expect, test } from "@playwright/test";

const pages = {
  "/quotations": "Quotations",
  "/customers": "Customers",
  "/approvals": "Approvals",
  "/fulfillment": "Fulfillment",
  "/subscriptions": "Subscriptions",
  "/invoices": "Invoices",
  "/health": "Customer health",
  "/reports": "Reports",
  "/catalog": "Product catalog",
  "/settings": "Settings",
};
const expected: Record<string, string[]> = {
  rep: ["/quotations", "/customers", "/fulfillment", "/subscriptions", "/invoices"],
  manager: [
    "/quotations",
    "/customers",
    "/approvals",
    "/fulfillment",
    "/subscriptions",
    "/invoices",
    "/health",
    "/reports",
    "/settings",
  ],
  finance: ["/quotations", "/approvals", "/subscriptions", "/invoices", "/reports"],
  ops: ["/quotations", "/fulfillment"],
  admin: ["/quotations", "/customers", "/reports", "/catalog", "/settings"],
};

for (const [role, allowed] of Object.entries(expected)) {
  test(`${role} navigation and direct URLs enforce the role policy @regression`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const password = Bun.env.DEMO_PASSWORD ?? Bun.env.PLAYWRIGHT_USER_PASSWORD;
    if (!password) throw new Error("Seeded demo password required");
    expect(
      (
        await page.request.post("/api/auth/sign-in/email", {
          data: { email: `${role}@dealflow360.demo`, password },
        })
      ).ok(),
    ).toBe(true);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Customer portal", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Create quotation", exact: true })).toHaveCount(
      role === "rep" ? 1 : 0,
    );
    for (const [path, name] of Object.entries(pages)) {
      await expect(page.getByRole("link", { name, exact: true })).toHaveCount(
        allowed.includes(path) ? 1 : 0,
      );
    }
    for (const path of Object.keys(pages)) {
      await page.goto(path);
      if (!allowed.includes(path))
        await expect(page.getByRole("heading", { name: "403 — Access denied" })).toBeVisible();
      else {
        await expect(page.getByRole("heading", { name: "403 — Access denied" })).toHaveCount(0);
        await expect(page.getByRole("heading").first()).toBeVisible();
      }
    }
    if (role !== "rep") {
      await page.goto("/quotations/new");
      await expect(page.getByRole("heading", { name: "403 — Access denied" })).toBeVisible();
    }
    if (role === "admin") {
      await page.goto("/settings");
      await page.getByRole("button", { name: "Add warehouse", exact: true }).click();
      const warehouse = `Setup ${crypto.randomUUID()}`;
      await page.getByLabel("Warehouse name", { exact: true }).fill(warehouse);
      await page.getByRole("button", { name: "Save warehouse", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: `Configure ${warehouse}`, exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Configure stock", exact: true }).click();
      await page.getByRole("combobox", { name: "Stockable product", exact: true }).click();
      await page.getByRole("option", { name: /^Laptop Pro 13 ·/ }).click();
      await page.getByRole("combobox", { name: "Warehouse", exact: true }).click();
      await page.getByRole("option", { name: warehouse, exact: true }).click();
      const configured = page.waitForResponse(
        (r) => r.url().endsWith("/api/v1/inventory/stocks") && r.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Configure location", exact: true }).click();
      const result = await configured;
      expect(result.status()).toBe(200);
      expect((await result.json()).onHand).toBe(0);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      const workspace = await (await page.request.get("/api/v1/workspace")).json();
      const pricelist = workspace.settings.find((s: { id: string }) => s.id === "pricelists");
      expect(
        (
          await page.request.patch("/api/v1/settings/pricelists", {
            headers: { origin: new URL(page.url()).origin },
            data: { value: pricelist.value },
          })
        ).status(),
      ).toBe(200);
      const approved = workspace.quotes.find(
        (q: { status: string }) => q.status === "APPROVED" || q.status === "SENT",
      );
      if (!approved) throw new Error("Expected an approved demo quotation");
      await page.goto(`/quotations/${approved.id}`);
      await expect(page.getByRole("heading", { name: approved.number, exact: true })).toBeVisible();
      for (const label of ["Approve", "Return", "Reject", "Send quotation email"])
        await expect(page.getByRole("button", { name: label, exact: true })).toHaveCount(0);
    }
  });
}
