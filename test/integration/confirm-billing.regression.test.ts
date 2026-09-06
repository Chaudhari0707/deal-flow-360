import { beforeAll, describe, expect, test } from "bun:test";

import { eq } from "drizzle-orm";

import { fulfillmentList } from "@/features/inventory/queries";
import { confirmQuote, saveQuote, submitQuote } from "@/features/quotes/service";
import { workspaceSnapshot } from "@/features/workspace/query";
import { createAuth } from "@/lib/auth/create-auth";
import { db } from "@/lib/db/connection";
import { customers, invoices, orders, products, profiles, subscriptions } from "@/lib/db/schema";
import type { Actor } from "@/lib/domain/_types/domain";
import type { Workspace } from "@/lib/domain/_types/workspace";
import { api } from "@/server/api";

const accounts: Record<string, { actor: Actor; cookie: string }> = {};
let customerId = "";
let oneTimeProductId = "";
let recurringProductId = "";

beforeAll(async () => {
  if (!new URL(Bun.env.DATABASE_URL!).pathname.endsWith("_test"))
    throw new Error("Confirm-billing tests require dedicated _test database");
  const suffix = crypto.randomUUID();
  customerId = `confirm-cust-${suffix}`;
  oneTimeProductId = `confirm-once-${suffix}`;
  recurringProductId = `confirm-recur-${suffix}`;
  await db.insert(customers).values({
    email: `confirm-cust-${suffix}@example.com`,
    id: customerId,
    name: "Confirm visibility customer",
  });
  await db.insert(products).values([
    {
      category: "Hardware",
      costCents: 1000,
      id: oneTimeProductId,
      intervalMonths: 0,
      name: "Confirm kit",
      priceCents: 5000,
      stockable: true,
    },
    {
      category: "Subscription",
      costCents: 500,
      id: recurringProductId,
      intervalMonths: 1,
      name: "Confirm care",
      priceCents: 2000,
      stockable: false,
    },
  ]);
  for (const [name, role, customer] of [
    ["rep", "rep", null],
    ["finance", "finance", null],
    ["manager", "manager", null],
    ["customer", "customer", customerId],
  ] as const) {
    const email = `confirm-${name}-${suffix}@example.com`;
    const password = `Confirm-${name}-${suffix}`;
    const created = await createAuth(db).api.signUpEmail({
      body: { email, name: `Confirm ${name}`, password },
    });
    await db.insert(profiles).values({
      customerId: customer,
      role,
      userId: created.user.id,
    });
    const session = await createAuth(db).api.signInEmail({
      asResponse: true,
      body: { email, password },
    });
    accounts[name] = {
      actor: {
        customerId: customer,
        email,
        id: created.user.id,
        name: `Confirm ${name}`,
        role,
      },
      cookie: session.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; "),
    };
  }
});

async function approveAndConfirm(lines: { productId: string; quantity: number }[]) {
  const draft = await saveQuote(
    { customerId, lines: lines.map((line) => ({ ...line, discountBps: 0 })), orderDiscountBps: 0 },
    accounts.rep!.actor,
  );
  const approved = await submitQuote(draft.id, draft.revision, accounts.rep!.actor);
  expect(approved.approvedRevision).toBe(approved.revision);
  return confirmQuote(approved.id, approved.revision, accounts.customer!.actor);
}

describe("confirmation surfaces for the same customer", () => {
  test("one-time only creates invoice and fulfillment order without a subscription", async () => {
    const order = await approveAndConfirm([{ productId: oneTimeProductId, quantity: 1 }]);
    const billed = await db.select().from(invoices).where(eq(invoices.orderId, order.id));
    const subs = await db.select().from(subscriptions).where(eq(subscriptions.orderId, order.id));
    expect(billed).toHaveLength(1);
    expect(billed[0]?.kind).toBe("ONE_TIME");
    expect(billed[0]?.customerId).toBe(customerId);
    expect(subs).toHaveLength(0);

    const workspace = await workspaceSnapshot(accounts.finance!.actor);
    expect(workspace.invoices.some((invoice) => invoice.orderId === order.id)).toBe(true);
    expect(workspace.subscriptions.some((entry) => entry.orderId === order.id)).toBe(false);
    expect(workspace.orders.some((entry) => entry.id === order.id)).toBe(true);

    const fulfillment = await fulfillmentList(0, 20);
    expect(fulfillment.items.some((item) => item.id === order.id)).toBe(true);
    expect(fulfillment.items[0]?.id).toBe(order.id);
  });

  test("recurring only creates subscription plus recurring invoice and still lists fulfillment", async () => {
    const order = await approveAndConfirm([{ productId: recurringProductId, quantity: 1 }]);
    const billed = await db.select().from(invoices).where(eq(invoices.orderId, order.id));
    const subs = await db.select().from(subscriptions).where(eq(subscriptions.orderId, order.id));
    const [persisted] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(billed).toHaveLength(1);
    expect(billed[0]?.kind).toBe("RECURRING");
    expect(subs).toHaveLength(1);
    expect(subs[0]?.customerId).toBe(customerId);
    expect(persisted?.fulfillmentStatus).toBe("FULFILLED");

    const workspace = await workspaceSnapshot(accounts.manager!.actor);
    expect(workspace.invoices.some((invoice) => invoice.orderId === order.id)).toBe(true);
    expect(workspace.subscriptions.some((entry) => entry.orderId === order.id)).toBe(true);
    expect(workspace.orders.some((entry) => entry.id === order.id)).toBe(true);

    const fulfillment = await fulfillmentList(0, 20);
    expect(fulfillment.items.some((item) => item.id === order.id)).toBe(true);
  });

  test("hybrid creates both streams separately and newest confirmation leads the lists", async () => {
    const older = await approveAndConfirm([{ productId: oneTimeProductId, quantity: 1 }]);
    const newer = await approveAndConfirm([
      { productId: oneTimeProductId, quantity: 1 },
      { productId: recurringProductId, quantity: 1 },
    ]);
    const billed = await db.select().from(invoices).where(eq(invoices.orderId, newer.id));
    const subs = await db.select().from(subscriptions).where(eq(subscriptions.orderId, newer.id));
    expect(billed.map((row) => row.kind).sort()).toEqual(["ONE_TIME", "RECURRING"]);
    expect(subs).toHaveLength(1);

    const workspace = await workspaceSnapshot(accounts.finance!.actor);
    expect(workspace.orders[0]?.id).toBe(newer.id);
    expect(workspace.orders.some((entry) => entry.id === older.id)).toBe(true);
    expect(workspace.invoices[0]?.orderId).toBe(newer.id);
    expect(workspace.subscriptions[0]?.orderId).toBe(newer.id);

    const response = await api.handle(
      new Request(`${Bun.env.BETTER_AUTH_URL}/api/v1/workspace`, {
        headers: { cookie: accounts.finance!.cookie },
      }),
    );
    expect(response.status).toBe(200);
    const data = (await response.json()) as Workspace;
    expect(data.orders[0]?.id).toBe(newer.id);
    expect(data.invoices[0]?.customerId).toBe(customerId);

    const fulfillment = await fulfillmentList(0, 5);
    expect(fulfillment.items[0]?.id).toBe(newer.id);
  });
});
