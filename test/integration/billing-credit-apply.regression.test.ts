import { beforeAll, describe, expect, test } from "bun:test";

import { eq } from "drizzle-orm";

import { createOrderBilling } from "@/features/billing/creation";
import { applyCustomerCredit, changeSubscription, recordPayment } from "@/features/billing/service";
import { createAuth } from "@/lib/auth/create-auth";
import { db } from "@/lib/db/connection";
import {
  credits,
  customers,
  invoices,
  orders,
  products,
  profiles,
  quotes,
  subscriptions,
} from "@/lib/db/schema";
import type { Actor, QuoteLine } from "@/lib/domain/_types/domain";
import { api } from "@/server/api";

let actor: Actor;
let cookie: string;
const now = new Date("2026-04-01T12:00:00Z");

beforeAll(async () => {
  if (!new URL(Bun.env.DATABASE_URL!).pathname.endsWith("_test"))
    throw new Error("Credit-apply tests require dedicated _test database");
  const id = crypto.randomUUID();
  const result = await createAuth(db).api.signUpEmail({
    body: {
      email: `credit-apply-${id}@example.com`,
      name: "Credit apply finance",
      password: `Credit-apply-${id}`,
    },
  });
  actor = {
    customerId: null,
    email: result.user.email,
    id: result.user.id,
    name: result.user.name,
    role: "finance",
  };
  await db.insert(profiles).values({ role: "finance", userId: actor.id });
  const signedIn = await createAuth(db).api.signInEmail({
    asResponse: true,
    body: { email: actor.email, password: `Credit-apply-${id}` },
  });
  cookie = signedIn.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
});

async function prepaidCancelFixture() {
  const id = crypto.randomUUID();
  const customerId = `credit-cust-${id}`;
  const productId = `credit-prod-${id}`;
  const line: QuoteLine = {
    category: "Service",
    costCents: 0,
    discountBps: 0,
    id: `line-${id}`,
    intervalMonths: 1,
    name: "Monthly service",
    netCents: 4600,
    priceCents: 4600,
    productId,
    quantity: 1,
    stockable: false,
    taxBps: 0,
    taxCents: 0,
    totalCents: 4600,
    variant: "Standard",
  };
  const oneTime: QuoteLine = {
    ...line,
    id: `once-${id}`,
    intervalMonths: 0,
    name: "Setup",
    netCents: 2000,
    priceCents: 2000,
    totalCents: 2000,
  };
  await db.insert(customers).values({
    email: `credit-cust-${id}@example.com`,
    id: customerId,
    name: "Credit customer",
  });
  await db.insert(products).values({
    category: "Service",
    costCents: 0,
    id: productId,
    intervalMonths: 1,
    name: "Monthly service",
    priceCents: 4600,
  });
  await db.insert(quotes).values({
    customerId,
    id: `quote-${id}`,
    lines: [line, oneTime],
    number: `QC-${id}`,
    ownerId: actor.id,
    status: "CONFIRMED",
  });
  const [order] = await db
    .insert(orders)
    .values({
      customerId,
      fulfillmentStatus: "FULFILLED",
      id: `order-${id}`,
      lines: [line, oneTime],
      number: `OC-${id}`,
      quoteId: `quote-${id}`,
    })
    .returning();
  await db.transaction((tx) => createOrderBilling(tx, order!, now));
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.orderId, order!.id));
  const billed = await db.select().from(invoices).where(eq(invoices.orderId, order!.id));
  const recurring = billed.find((row) => row.kind === "RECURRING")!;
  const other = billed.find((row) => row.kind === "ONE_TIME")!;
  await recordPayment(actor, recurring.id, crypto.randomUUID(), "PREPAID");
  await changeSubscription(
    actor,
    subscription!.id,
    { operationKey: crypto.randomUUID(), reason: "Cancel prepaid plan", version: 1 },
    true,
    new Date("2026-04-16T00:00:00Z"),
  );
  return { customerId, other, recurring, subscription: subscription! };
}

describe("manual customer credit application", () => {
  test("prepaid cancel credit applies to another unpaid invoice for the same customer", async () => {
    const data = await prepaidCancelFixture();
    const [credit] = await db
      .select()
      .from(credits)
      .where(eq(credits.subscriptionId, data.subscription.id));
    expect(credit?.amountCents).toBe(2300);
    expect(credit?.appliedCents).toBe(0);
    expect(credit?.customerId).toBe(data.customerId);

    const result = await applyCustomerCredit(actor, data.other.id, crypto.randomUUID());
    expect(result.appliedCents).toBe(2000);
    expect(result.invoice?.status).toBe("PAID");
    expect(result.invoice?.creditedCents).toBe(2000);

    const [updatedCredit] = await db.select().from(credits).where(eq(credits.id, credit!.id));
    expect(updatedCredit?.appliedCents).toBe(2000);
    const [target] = await db.select().from(invoices).where(eq(invoices.id, data.other.id));
    expect(target?.status).toBe("PAID");
    expect(target?.creditedCents).toBe(2000);
  });

  test("apply-credit API is retry-safe and rejects empty credit pools", async () => {
    const data = await prepaidCancelFixture();
    const key = crypto.randomUUID();
    const first = await api.handle(
      new Request(`${Bun.env.BETTER_AUTH_URL}/api/v1/invoices/${data.other.id}/apply-credit`, {
        body: JSON.stringify({ operationKey: key }),
        headers: {
          cookie,
          "content-type": "application/json",
          origin: new URL(Bun.env.BETTER_AUTH_URL!).origin,
        },
        method: "POST",
      }),
    );
    expect(first.status).toBe(200);
    const body = (await first.json()) as { appliedCents: number };
    expect(body.appliedCents).toBe(2000);

    const retry = await api.handle(
      new Request(`${Bun.env.BETTER_AUTH_URL}/api/v1/invoices/${data.other.id}/apply-credit`, {
        body: JSON.stringify({ operationKey: key }),
        headers: {
          cookie,
          "content-type": "application/json",
          origin: new URL(Bun.env.BETTER_AUTH_URL!).origin,
        },
        method: "POST",
      }),
    );
    expect(retry.status).toBe(200);

    const empty = await applyCustomerCredit(actor, data.recurring.id, crypto.randomUUID()).catch(
      (error: Error) => error,
    );
    expect(empty).toBeInstanceOf(Error);
    expect(String(empty)).toMatch(/no outstanding balance|No available customer credit/i);
  });
});
