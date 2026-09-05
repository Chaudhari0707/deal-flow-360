import { beforeAll, describe, expect, test } from "bun:test";

import { eq } from "drizzle-orm";

import { approvalAction, saveQuote, submitQuote } from "@/features/quotes/service";
import { createAuth } from "@/lib/auth/create-auth";
import { db } from "@/lib/db/connection";
import { customers, products, profiles, settings } from "@/lib/db/schema";
import type { Actor, Role } from "@/lib/domain/_types/domain";

const suffix = crypto.randomUUID();
const customerId = `approval-customer-${suffix}`;
const productId = `approval-product-${suffix}`;
const actors = {} as Record<"rep" | "manager" | "finance", Actor>;

beforeAll(async () => {
  if (!new URL(Bun.env.DATABASE_URL!).pathname.endsWith("_test"))
    throw new Error("Approval workflow regression requires _test database");
  await db.insert(customers).values({
    email: `${customerId}@example.com`,
    id: customerId,
    name: "Approval workflow customer",
  });
  await db.insert(products).values({
    category: "Services",
    costCents: 1000,
    id: productId,
    name: "Approval workflow service",
    priceCents: 10000,
  });
  for (const role of ["rep", "manager", "finance"] as const) {
    const email = `${role}-${suffix}@example.com`;
    const created = await createAuth(db).api.signUpEmail({
      body: { email, name: `Approval ${role}`, password: `Approval-${suffix}!` },
    });
    await db.insert(profiles).values({ role, userId: created.user.id });
    actors[role] = {
      customerId: null,
      email,
      id: created.user.id,
      name: `Approval ${role}`,
      role: role as Role,
    };
  }
});

describe("high-risk approval routing", () => {
  test("routes a Finance return back to the Sales Manager", async () => {
    const draft = await saveQuote(
      {
        customerId,
        lines: [{ discountBps: 5000, productId, quantity: 1 }],
        orderDiscountBps: 0,
      },
      actors.rep!,
    );
    const submitted = await submitQuote(draft.id, draft.revision, actors.rep!);
    expect(submitted.risk).toBe("HIGH");
    expect(submitted.approvalStep).toBe("manager");

    const managerApproved = await approvalAction(
      draft.id,
      submitted.revision,
      "approve",
      "Sales Manager reviewed the high-risk discount.",
      actors.manager!,
    );
    expect(managerApproved.status).toBe("PENDING_APPROVAL");
    expect(managerApproved.approvalStep).toBe("finance");

    const financeReturned = await approvalAction(
      draft.id,
      submitted.revision,
      "return",
      "Finance requested another Sales Manager review.",
      actors.finance!,
    );
    expect(financeReturned.status).toBe("PENDING_APPROVAL");
    expect(financeReturned.approvalStep).toBe("manager");
    expect(financeReturned.approvedRevision).toBeNull();

    const reapproved = await approvalAction(
      draft.id,
      submitted.revision,
      "approve",
      "Sales Manager completed the Finance follow-up review.",
      actors.manager!,
    );
    expect(reapproved.status).toBe("PENDING_APPROVAL");
    expect(reapproved.approvalStep).toBe("finance");

    const final = await approvalAction(
      draft.id,
      submitted.revision,
      "approve",
      "Finance approved the follow-up review.",
      actors.finance!,
    );
    expect(final.status).toBe("APPROVED");
    expect(final.approvalStep).toBeNull();
    expect(final.approvedRevision).toBe(submitted.revision);
  });

  test("uses the configured order instead of a hardcoded role sequence", async () => {
    await db
      .update(settings)
      .set({ value: { manager: 2, finance: 1 } })
      .where(eq(settings.id, "approvalChain"));
    try {
      const draft = await saveQuote(
        { customerId, lines: [{ discountBps: 5000, productId, quantity: 1 }], orderDiscountBps: 0 },
        actors.rep!,
      );
      const submitted = await submitQuote(draft.id, draft.revision, actors.rep!);
      expect(submitted.approvalStep).toBe("finance");
      const next = await approvalAction(
        draft.id,
        submitted.revision,
        "approve",
        "Finance reviewed first under the configured chain.",
        actors.finance!,
      );
      expect(next.status).toBe("PENDING_APPROVAL");
      expect(next.approvalStep).toBe("manager");
    } finally {
      await db
        .update(settings)
        .set({ value: { manager: 1, finance: 2 } })
        .where(eq(settings.id, "approvalChain"));
    }
  });
});
