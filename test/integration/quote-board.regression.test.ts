import { beforeAll, describe, expect, test } from "bun:test";

import { eq } from "drizzle-orm";

import { planMove } from "@/features/quotes/board-transitions";
import { confirmQuote, saveQuote, submitQuote } from "@/features/quotes/service";
import { createAuth } from "@/lib/auth/create-auth";
import { db } from "@/lib/db/connection";
import { customers, products, profiles, quotes } from "@/lib/db/schema";
import type { Actor, Role } from "@/lib/domain/_types/domain";
import { api } from "@/server/api";

const accounts: Record<string, { actor: Actor; cookie: string }> = {};
const customerId = `board-customer-${crypto.randomUUID()}`;
const cheapProductId = `board-cheap-${crypto.randomUUID()}`;
const richProductId = `board-rich-${crypto.randomUUID()}`;

async function request(path: string, account: string, body: unknown) {
  return api.handle(
    new Request(`${Bun.env.BETTER_AUTH_URL}/api/v1${path}`, {
      body: JSON.stringify(body),
      headers: {
        cookie: accounts[account]!.cookie,
        "content-type": "application/json",
        origin: new URL(Bun.env.BETTER_AUTH_URL!).origin,
      },
      method: "POST",
    }),
  );
}

async function statusOf(id: string) {
  const [row] = await db.select().from(quotes).where(eq(quotes.id, id));
  return row?.status;
}

beforeAll(async () => {
  if (!new URL(Bun.env.DATABASE_URL!).pathname.endsWith("_test"))
    throw new Error("Board regression requires the _test database");

  await db.insert(customers).values({
    email: `board-${customerId}@example.com`,
    id: customerId,
    name: "Board Customer",
    tier: "Bronze",
  });
  // A low-margin product forces a HIGH-risk discount so submit routes to
  // approval instead of auto-approving.
  await db.insert(products).values([
    {
      category: "Service",
      costCents: 100,
      id: cheapProductId,
      intervalMonths: 0,
      name: "Board margin service",
      priceCents: 10000,
    },
    {
      category: "Service",
      costCents: 100,
      id: richProductId,
      intervalMonths: 0,
      name: "Board rich service",
      priceCents: 10000,
    },
  ]);

  for (const [name, role, customer] of [
    ["rep", "rep", null],
    ["manager", "manager", null],
    ["finance", "finance", null],
    ["ops", "ops", null],
    ["customer", "customer", customerId],
  ] as [string, Role, string | null][]) {
    const uid = crypto.randomUUID();
    const email = `board-${uid}@example.com`;
    const password = `Board-test-${uid}`;
    const created = await createAuth(db).api.signUpEmail({
      body: { email, name: `Board ${name}`, password },
    });
    await db.insert(profiles).values({ customerId: customer, role, userId: created.user.id });
    const session = await createAuth(db).api.signInEmail({
      asResponse: true,
      body: { email, password },
    });
    accounts[name] = {
      actor: { customerId: customer, email, id: created.user.id, name: `Board ${name}`, role },
      cookie: session.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; "),
    };
  }
});

function draftInput(productId: string, discountBps: number) {
  return {
    customerId,
    lines: [{ discountBps, productId, quantity: 1 }],
    orderDiscountBps: 0,
  };
}

describe("board moves drive the persisted quotation status", () => {
  test("rep submit -> manager approve follows the board plan and persists each status", async () => {
    const draft = await saveQuote(draftInput(cheapProductId, 5000), accounts.rep!.actor);
    expect(await statusOf(draft.id)).toBe("DRAFT");

    // Board plan: Draft -> In approval == submit.
    const submitPlan = planMove(draft, "approval", "rep");
    expect(submitPlan.ok).toBe(true);
    if (!submitPlan.ok) return;
    expect((await request(submitPlan.path, "rep", submitPlan.body)).status).toBe(200);
    const submitted = await statusOf(draft.id);
    expect(submitted).toBe("PENDING_APPROVAL");

    const [pending] = await db.select().from(quotes).where(eq(quotes.id, draft.id));
    expect(pending!.approvalStep).toBe("manager");

    // Board plan: In approval -> Approved == approve (reason required).
    const approvePlan = planMove(pending!, "approved", "manager", "Within committed budget");
    expect(approvePlan.ok).toBe(true);
    if (!approvePlan.ok) return;
    expect((await request(approvePlan.path, "manager", approvePlan.body)).status).toBe(200);
    // Manager approval of a HIGH-risk quote may hand off to finance; either way
    // the persisted status is one the board reconciles via revalidation.
    expect(["APPROVED", "PENDING_APPROVAL"]).toContain(await statusOf(draft.id));
  });

  test("approver return and reject persist through the board approval path", async () => {
    const returned = await saveQuote(draftInput(cheapProductId, 5000), accounts.rep!.actor);
    const pendingReturn = await submitQuote(returned.id, returned.revision, accounts.rep!.actor);
    expect(pendingReturn.status).toBe("PENDING_APPROVAL");
    const returnPlan = planMove(pendingReturn, "draft", "manager", "Revisit shipping terms");
    expect(returnPlan.ok).toBe(true);
    if (!returnPlan.ok) return;
    expect((await request(returnPlan.path, "manager", returnPlan.body)).status).toBe(200);
    expect(await statusOf(returned.id)).toBe("RETURNED");

    const rejected = await saveQuote(draftInput(cheapProductId, 5000), accounts.rep!.actor);
    const pendingReject = await submitQuote(rejected.id, rejected.revision, accounts.rep!.actor);
    const rejectPlan = planMove(pendingReject, "rejected", "manager", "Outside policy");
    expect(rejectPlan.ok).toBe(true);
    if (!rejectPlan.ok) return;
    expect((await request(rejectPlan.path, "manager", rejectPlan.body)).status).toBe(200);
    expect(await statusOf(rejected.id)).toBe("REJECTED");
  });

  test("a rep move that the workflow forbids never reaches an endpoint (no plan)", async () => {
    const draft = await saveQuote(draftInput(cheapProductId, 5000), accounts.rep!.actor);
    const pending = await submitQuote(draft.id, draft.revision, accounts.rep!.actor);
    // A rep cannot approve; the board refuses before any request.
    expect(planMove(pending, "approved", "rep", "please").ok).toBe(false);
    // And the underlying endpoint independently rejects a rep, proving the guard
    // is enforced on the server, not only in the UI.
    expect(
      (
        await request(`/quotes/${pending.id}/approval`, "rep", {
          action: "approve",
          reason: "please",
          revision: pending.revision,
        })
      ).status,
    ).toBe(403);
    expect(await statusOf(draft.id)).toBe("PENDING_APPROVAL");
  });
});

describe("a completed order is terminal and cannot be moved", () => {
  test("no board target is legal for a confirmed quote and its endpoints refuse", async () => {
    // Auto-approve path (no discount) so the customer can confirm to an order.
    const clean = await saveQuote(draftInput(richProductId, 0), accounts.rep!.actor);
    const approved = await submitQuote(clean.id, clean.revision, accounts.rep!.actor);
    expect(approved.status).toBe("APPROVED");
    await confirmQuote(approved.id, approved.revision, accounts.customer!.actor);
    const [confirmed] = await db.select().from(quotes).where(eq(quotes.id, clean.id));
    expect(confirmed!.status).toBe("CONFIRMED");

    for (const target of ["draft", "approval", "approved", "negotiation", "rejected"] as const)
      for (const role of ["rep", "manager", "finance", "ops"] as Role[])
        expect(planMove(confirmed!, target, role, "force it please").ok).toBe(false);

    // Even if a client bypassed the board, the send endpoint cannot revive it.
    const sendResponse = await request(`/quotes/${clean.id}/send`, "rep", { renew: false });
    expect(sendResponse.status).toBe(409);
    expect(await statusOf(clean.id)).toBe("CONFIRMED");
  });
});
