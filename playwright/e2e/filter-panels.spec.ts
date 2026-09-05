import { expect, test } from "@playwright/test";

for (const [role, path, placeholder] of [
  ["rep", "/quotations", "Search customer, quotation or stage…"],
  ["manager", "/approvals", "Search customer, quotation or stage…"],
  ["rep", "/customers", "Search customers…"],
  ["admin", "/catalog", "Search products…"],
  ["finance", "/invoices", "Search invoice or customer"],
  ["finance", "/subscriptions", "Search plan, customer or order"],
  ["acme", "/portal", "Search quotations…"],
] as const) {
  test(`${path} search-only filters remain visible without a toggle @regression`, async ({
    page,
  }) => {
    const password = Bun.env.DEMO_PASSWORD ?? Bun.env.PLAYWRIGHT_USER_PASSWORD;
    if (!password) throw new Error("Seeded demo credentials required");
    const login = await page.request.post("/api/auth/sign-in/email", {
      data: { email: `${role}@dealflow360.demo`, password },
    });
    expect(login.ok()).toBe(true);
    await page.goto(path);
    const input = page.getByPlaceholder(placeholder, { exact: true });
    await expect(page.getByRole("button", { name: /^(Show|Hide) filters$/ })).toHaveCount(0);
    await expect(input).toBeVisible();
    await input.fill("no-matching-record-filter");
    await expect(input).toBeVisible();
    await expect(input).toHaveValue("no-matching-record-filter");
    await input.fill("");
    await expect(input).toHaveValue("");
  });
}
