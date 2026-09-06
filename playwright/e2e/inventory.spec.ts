import { expect, type Page, test } from "@playwright/test";

import type { FulfillmentDetail, InventorySnapshot } from "@/features/inventory/_types/ui";

test.setTimeout(60_000);

function password() {
  const value = Bun.env.DEMO_PASSWORD;
  if (!value)
    throw new Error("Inventory browser tests require DEMO_PASSWORD and the canonical demo seed");
  return value;
}

/**
 * The fulfillment list is server-paginated at 20 and ordered newest first, so a seeded order is
 * pushed off the first page once earlier specs in the run have created enough orders. Page
 * forward to it rather than assuming it is on page one.
 */
async function fulfillmentRow(page: Page, order: string) {
  const row = () => page.getByRole("row").filter({ hasText: order });
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if ((await row().count()) > 0) return row();
    const next = page.getByRole("button", { name: "Go to next page" });
    if (!(await next.isEnabled().catch(() => false))) break;
    await next.click();
    await expect(next)
      .toBeEnabled({ timeout: 5000 })
      .catch(() => {});
  }
  return row();
}

test("Admin restock reaches another live tab, then Ops consolidates and ships Northwind once @regression", async ({
  baseURL,
  page,
  context,
}) => {
  const login = await page.request.post("/api/auth/sign-in/email", {
    data: { email: "admin@dealflow360.demo", password: password() },
  });
  expect(login.ok()).toBe(true);
  const beforeResponse = await page.request.get("/api/v1/inventory?pageSize=100");
  expect(beforeResponse.ok()).toBe(true);
  const before = ((await beforeResponse.json()) as InventorySnapshot).stocks.find(
    (s) => s.id === "east-laptop13",
  );
  expect(before).toBeDefined();
  const orderResponse = await page.request.get("/api/v1/fulfillment/order-Q-1022");
  const order = (await orderResponse.json()) as FulfillmentDetail;
  expect(order.backorders).toEqual([
    { productId: "laptop13", product: "Laptop Pro 13", quantity: 4 },
  ]);
  expect(order.allocations[0]?.shipped).toBe(0);

  await page.goto("/inventory");
  await expect(page.getByRole("heading", { name: "Inventory", exact: true })).toBeVisible();
  await expect(page.getByText("Live stock", { exact: true })).toBeVisible();
  const observer = await context.newPage();
  const receivedSnapshots: InventorySnapshot[] = [];
  observer.on("websocket", (socket) => {
    if (!socket.url().endsWith("/stock")) return;
    socket.on("framereceived", (event) => {
      const message = JSON.parse(String(event.payload)) as {
        data: InventorySnapshot;
        type: string;
      };
      if (message.type === "stock.snapshot") receivedSnapshots.push(message.data);
    });
  });
  await observer.goto("/inventory");
  await expect(observer.getByText("Live stock", { exact: true })).toBeVisible();
  const observerRow = observer.getByRole("row").filter({ hasText: "Laptop Pro 13" });
  await expect(observerRow).toContainText("13 inch");

  const restockRow = page.getByRole("row").filter({ hasText: "Laptop Pro 13" });
  await restockRow.press("Enter");
  const restockDialog = page.getByRole("dialog", {
    name: "Restock Laptop Pro 13 at East Depot",
    exact: true,
  });
  await expect(restockDialog).toBeVisible();
  await expect(restockDialog.locator("[data-slot='dialog-footer']")).toBeVisible();
  await restockDialog.getByRole("combobox", { name: "Warehouse", exact: true }).click();
  await expect(
    page.getByRole("option", {
      name: `East Depot · on hand ${before!.onHand} · available ${before!.available}`,
      exact: true,
    }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await restockDialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(restockDialog).toHaveCount(0);
  await restockRow.click();
  await expect(restockDialog).toBeVisible();
  await restockDialog.getByLabel("Quantity received", { exact: true }).fill("8");
  await restockDialog
    .getByLabel("Receipt note", { exact: true })
    .fill("Browser acceptance receipt");
  await restockDialog.getByRole("button", { name: "Receive stock", exact: true }).click();
  await expect(restockDialog).toHaveCount(0);
  await expect
    .poll(() =>
      receivedSnapshots.some((snapshot) =>
        snapshot.stocks.some(
          (stock) => stock.id === "east-laptop13" && stock.onHand === before!.onHand + 8,
        ),
      ),
    )
    .toBe(true);
  // This tab did not perform the mutation; a committed WebSocket frame proves the live feed.

  // The context now holds the admin session cookie, so Better Auth enforces the request origin.
  const opsLogin = await page.request.post("/api/auth/sign-in/email", {
    headers: { origin: new URL(baseURL!).origin },
    data: { email: "ops@dealflow360.demo", password: password() },
  });
  expect(opsLogin.ok()).toBe(true);
  await page.goto("/fulfillment");
  await (await fulfillmentRow(page, "SO-1022")).click();
  const fulfillmentDialog = page.getByRole("dialog", { name: "SO-1022", exact: true });
  await expect(fulfillmentDialog).toBeVisible();
  await expect(fulfillmentDialog.locator("[data-slot='dialog-footer']")).toBeVisible();
  await fulfillmentDialog
    .getByRole("button", { name: "Consolidate remaining backorder", exact: true })
    .click();
  await expect(
    fulfillmentDialog.getByRole("button", { name: "Consolidate remaining backorder", exact: true }),
  ).toHaveCount(0);
  await fulfillmentDialog.getByRole("button", { name: "Accept shipment", exact: true }).click();
  await expect(
    fulfillmentDialog.getByRole("button", { name: "Accept shipment", exact: true }),
  ).toHaveCount(0);
  await fulfillmentDialog
    .getByRole("button", { name: "Ship 8 Laptop Pro 13 · East Depot", exact: true })
    .click();
  await expect(fulfillmentDialog.getByText("Fulfilled", { exact: true })).toBeVisible();
  await expect(
    fulfillmentDialog.getByRole("button", { name: "Accept shipment", exact: true }),
  ).toHaveCount(0);
  await expect(
    fulfillmentDialog.getByRole("button", { name: "Manual override", exact: true }),
  ).toHaveCount(0);
  await expect(fulfillmentDialog.getByRole("button", { name: /^Ship 8 Laptop/ })).toHaveCount(0);
  const after = (await (
    await page.request.get("/api/v1/fulfillment/order-Q-1022")
  ).json()) as FulfillmentDetail;
  expect(after.allocations.reduce((sum, a) => sum + a.shipped, 0)).toBe(8);
  expect(after.movements.filter((m) => m.kind === "SHIP")).toHaveLength(1);
  await fulfillmentDialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(fulfillmentDialog).toHaveCount(0);
  await expect(await fulfillmentRow(page, "SO-1022")).toContainText("Fulfilled");
  await observer.close();
});

test("a sales rep can inspect inventory but cannot receive or dispatch stock", async ({
  baseURL,
  page,
}) => {
  const login = await page.request.post("/api/auth/sign-in/email", {
    data: { email: "rep@dealflow360.demo", password: password() },
  });
  expect(login.ok()).toBe(true);
  await page.goto("/inventory");
  await expect(page.getByRole("heading", { name: "Inventory", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Configure stock", exact: true })).toHaveCount(0);
  await page.getByRole("row").filter({ hasText: "Laptop Pro 13" }).click();
  await expect(page.getByRole("button", { name: "Receive stock", exact: true })).toHaveCount(0);
  const receipt = await page.request.post("/api/v1/inventory/restock", {
    headers: { origin: new URL(baseURL!).origin },
    data: {
      operationKey: crypto.randomUUID(),
      productId: "laptop13",
      warehouseId: "east",
      quantity: 8,
      reason: "Unauthorized receipt attempt",
    },
  });
  expect(receipt.status()).toBe(403);
  const shipment = await page.request.post("/api/v1/fulfillment/order-Q-1022/ship", {
    headers: { origin: new URL(baseURL!).origin },
    data: { operationKey: crypto.randomUUID(), reservationId: "northwind-east", quantity: 1 },
  });
  expect(shipment.status()).toBe(403);
});
