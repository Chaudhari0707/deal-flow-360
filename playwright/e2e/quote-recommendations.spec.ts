import { expect, test } from "@playwright/test";

import type { PurchaseRecommendations } from "@/features/quotes/_types/recommendations";
import type { Workspace } from "@/lib/domain/_types/workspace";

test("purchase recommendations: best sellers, customer switch and add @regression", async ({
  page,
  baseURL,
}) => {
  const password = Bun.env.DEMO_PASSWORD ?? Bun.env.PLAYWRIGHT_USER_PASSWORD;
  if (!password) throw new Error("Seeded demo credentials required");
  const login = await page.request.post("/api/auth/sign-in/email", {
    data: { email: "rep@dealflow360.demo", password },
  });
  expect(login.ok()).toBe(true);
  const created = await page.request.post("/api/v1/customers", {
    headers: { origin: new URL(baseURL!).origin },
    data: {
      name: `Recommendation ${crypto.randomUUID()}`,
      email: "recommendation@example.com",
      tier: "Bronze",
    },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const fresh = (await created.json()) as Workspace["customers"][number];
  const workspace = await page.request.get("/api/v1/workspace");
  expect(workspace.ok()).toBe(true);
  const data = (await workspace.json()) as Workspace;
  let returning: Workspace["customers"][number] | undefined;
  for (const customer of data.customers) {
    const response = await page.request.get(
      `/api/v1/quotes/recommendations?customerId=${customer.id}`,
    );
    expect(response.ok()).toBe(true);
    const result = (await response.json()) as PurchaseRecommendations;
    if (result.source === "last_purchase" && result.productIds.length) {
      returning = customer;
      break;
    }
  }
  expect(returning).toBeDefined();
  const best = await page.request.get(`/api/v1/quotes/recommendations?customerId=${fresh.id}`);
  expect(best.ok()).toBe(true);
  const recommendations = (await best.json()) as PurchaseRecommendations;
  expect(recommendations.source).toBe("best_sellers");
  const product = data.products.find((item) => item.id === recommendations.productIds[0]);
  expect(product).toBeDefined();

  await page.goto("/quotations/new");
  const select = async (customer: Workspace["customers"][number]) => {
    await page.getByRole("combobox", { name: "Customer", exact: true }).click();
    await page
      .getByRole("option", { name: `${customer.name} · ${customer.tier}`, exact: true })
      .click();
  };
  await select(fresh);
  await expect(
    page.getByText("Best sellers — this customer has no purchases yet.", { exact: true }),
  ).toBeVisible();
  const add = page.getByRole("button", {
    name: `Add ${product!.name} recommendation to quote`,
    exact: true,
  });
  await expect(add).toBeVisible();
  await expect(page.getByText(/^(Promotion discount|Estimated margin) /).first()).toBeVisible();
  await expect(page.getByText(/Max discount .* · Margin /)).toHaveCount(0);
  for (const id of recommendations.productIds) {
    const suggested = data.products.find((item) => item.id === id);
    if (!suggested) continue;
    const card = page
      .getByRole("button", {
        name: `Add ${suggested.name} recommendation to quote`,
        exact: true,
      })
      .locator("../..");
    const promoted = suggested.promoted && suggested.promotionBps > 0;
    await expect(
      card.getByText(promoted ? /^Promotion discount / : /^Estimated margin /),
    ).toBeVisible();
    await expect(
      card.getByText(promoted ? /^Estimated margin / : /^Promotion discount /),
    ).toHaveCount(0);
  }
  expect(
    await page.getByRole("button", { name: / recommendation to quote$/ }).count(),
  ).toBeLessThanOrEqual(5);
  await select(returning!);
  await expect(
    page.getByText("From this customer’s last purchase.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Best sellers — this customer has no purchases yet.", { exact: true }),
  ).toHaveCount(0);
  await select(fresh);
  await expect(add).toBeVisible();
  const refreshed = page.waitForResponse(
    (response) =>
      response.url().includes("/quotes/recommendations?") &&
      response.url().includes("selectedProductIds") &&
      response.request().method() === "GET",
  );
  await add.click();
  const refreshedResponse = await refreshed;
  expect(refreshedResponse.ok(), await refreshedResponse.text()).toBe(true);
  const updated = (await refreshedResponse.json()) as PurchaseRecommendations;
  expect(updated.productIds).not.toContain(product!.id);
  expect(updated.productIds.length).toBeLessThanOrEqual(5);
  await expect(add).toHaveCount(0);
  await expect(page.getByLabel(`${product!.name} quantity`, { exact: true })).toHaveValue("1");
  await page.getByRole("button", { name: `Remove ${product!.name}`, exact: true }).click();
  await expect(add).toBeVisible();
  await add.click();
  await expect(page.getByLabel(`${product!.name} quantity`, { exact: true })).toHaveValue("1");
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/quotes") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  const response = await saved;
  expect(response.ok()).toBe(true);
  const quote = (await response.json()) as Workspace["quotes"][number];
  expect(quote.customerId).toBe(fresh.id);
  expect(quote.lines).toHaveLength(1);
  expect(quote.lines[0]!.productId).toBe(product!.id);
  expect(quote.lines[0]!.upsell).toBe(false);
  expect(quote.lines[0]!.priceCents).toBeGreaterThan(0);
});
