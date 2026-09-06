import { expect, test } from "@playwright/test";

test("only managers and admins can add customers; representatives retain directory access @regression", async ({
  browser,
  baseURL,
}) => {
  const password = Bun.env.DEMO_PASSWORD ?? Bun.env.PLAYWRIGHT_USER_PASSWORD;
  if (!password || !baseURL) throw new Error("Seeded credentials and base URL required");
  for (const role of ["rep", "manager", "admin"] as const) {
    const context = await browser.newContext({ baseURL });
    try {
      expect(
        (
          await context.request.post("/api/auth/sign-in/email", {
            data: { email: `${role}@dealflow360.demo`, password },
          })
        ).ok(),
      ).toBe(true);
      const page = await context.newPage();
      await page.goto("/customers");
      await expect(page.getByPlaceholder("Search customers…")).toBeVisible();
      const add = page.getByRole("button", { name: "Add customer", exact: true });
      if (role === "rep") {
        await expect(add).toHaveCount(0);
        const response = await context.request.post("/api/v1/customers", {
          headers: { origin: new URL(baseURL).origin },
          data: {
            name: "Denied creation",
            email: `denied-${crypto.randomUUID()}@example.test`,
            tier: "Gold",
          },
        });
        expect(response.status()).toBe(403);
      } else {
        await add.click();
        await expect(
          page.getByRole("button", { name: "Delete customer", exact: true }),
        ).toHaveCount(0);
        const name = `${role} customer ${crypto.randomUUID()}`;
        await page.getByRole("textbox", { name: "Name", exact: true }).fill(name);
        await page
          .getByLabel("Customer email", { exact: true })
          .fill(`${crypto.randomUUID()}@example.test`);
        await page.getByRole("button", { name: "Save customer", exact: true }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await page.getByPlaceholder("Search customers…").fill(name);
        await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible();
        await page
          .getByRole("row")
          .filter({ hasText: name })
          .getByRole("button", { name: "Edit customer", exact: true })
          .click();
        await page.getByRole("button", { name: "Delete customer", exact: true }).click();
        const confirmation = page.getByRole("alertdialog");
        await expect(confirmation).toContainText(`Delete ${name}?`);
        await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
        await expect(confirmation).toHaveCount(0);
        await expect(
          page.getByRole("dialog", { name: "Edit customer", exact: true }),
        ).toBeVisible();
        await page.getByRole("button", { name: "Delete customer", exact: true }).click();
        await confirmation.getByRole("button", { name: "Confirm deletion", exact: true }).click();
        await expect(confirmation).toHaveCount(0);
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(page.getByRole("row").filter({ hasText: name })).toHaveCount(0);
      }
    } finally {
      await context.close();
    }
  }
});
