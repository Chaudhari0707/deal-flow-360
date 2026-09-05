import { expect, test } from "@playwright/test";

import type { FulfillmentDetail, InventorySnapshot } from "@/features/inventory/_types/ui";

test.setTimeout(60_000);

function password() {
  const value = Bun.env.DEMO_PASSWORD;
  if (!value)
    throw new Error("Inventory browser tests require DEMO_PASSWORD and the canonical demo seed");
  return value;
}

test("Ops restock reaches another live tab, then consolidates and ships Northwind once @regression", async ({
  page,
  context,
}) => {
  const login = await page.request.post("/api/auth/sign-in/email", {
    data: { email: "ops@dealflow360.demo", password: password() },
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
  await expect(observerRow.getByRole("cell").nth(4)).toHaveText(String(before!.available));

  await page.getByRole("row").filter({ hasText: "Laptop Pro 13" }).click();
  await page.getByLabel("Quantity received", { exact: true }).fill("8");
  await page.getByLabel("Receipt note", { exact: true }).fill("Browser acceptance receipt");
  await page.getByRole("button", { name: "Receive stock", exact: true }).click();
  await expect(
    page.getByText("Stock received. Backorders can now be consolidated.", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      receivedSnapshots.some((snapshot) =>
        snapshot.stocks.some(
          (stock) => stock.id === "east-laptop13" && stock.onHand === before!.onHand + 8,
        ),
      ),
    )
    .toBe(true);
  // This tab did not perform the mutation; a committed WebSocket frame and UI change prove the feed.
  await expect(observerRow.getByRole("cell").nth(2)).toHaveText(String(before!.onHand + 8));
  await expect(observerRow.getByRole("cell").nth(4)).toHaveText(String(before!.available + 8));

  await page.goto("/fulfillment/order-Q-1022");
  await expect(page.getByRole("heading", { name: "SO-1022", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Consolidate remaining backorder", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Consolidate remaining backorder", exact: true }),
  ).toHaveCount(0);
  await expect(observerRow.getByRole("cell").nth(3)).toHaveText(String(before!.reserved + 4));
  await expect(observerRow.getByRole("cell").nth(4)).toHaveText(String(before!.available + 4));
  await page.getByRole("button", { name: "Accept suggested split", exact: true }).click();
  await expect(page.getByRole("button", { name: "Split accepted", exact: true })).toBeDisabled();
  await expect(observerRow.getByRole("cell").nth(3)).toHaveText(String(before!.reserved + 4));
  await page
    .getByRole("button", { name: "Ship 8 Laptop Pro 13 · East Depot", exact: true })
    .click();
  await expect(page.getByText("FULFILLED", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Ship 8 Laptop/ })).toHaveCount(0);
  await expect(observerRow.getByRole("cell").nth(2)).toHaveText(String(before!.onHand));
  await expect(observerRow.getByRole("cell").nth(3)).toHaveText(String(before!.reserved - 4));
  const after = (await (
    await page.request.get("/api/v1/fulfillment/order-Q-1022")
  ).json()) as FulfillmentDetail;
  expect(after.allocations.reduce((sum, a) => sum + a.shipped, 0)).toBe(8);
  expect(after.movements.filter((m) => m.kind === "SHIP")).toHaveLength(1);
  await observer.close();
});

test("a sales rep can inspect inventory but cannot receive or dispatch stock", async ({ page }) => {
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
    data: { operationKey: crypto.randomUUID(), reservationId: "northwind-east", quantity: 1 },
  });
  expect(shipment.status()).toBe(403);
});
