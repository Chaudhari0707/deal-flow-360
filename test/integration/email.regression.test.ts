import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

import { eq } from "drizzle-orm";

import { createAuth } from "@/lib/auth/create-auth";
import { closeDatabase, db } from "@/lib/db/connection";
import {
  auditEntries,
  customers,
  deliveries,
  products,
  quoteAccess,
  quoteRevisions,
  quotes,
  user,
} from "@/lib/db/schema";
import type { Actor } from "@/lib/domain/_types/domain";

type Envelope = { from: string; subject: string; text: string; to: string };
type ProviderResult = { data: { id: string } | null; error: { message: string } | null };
const calls: { message: Envelope; key: string }[] = [];
let reject = false;
let dispatch: (() => Promise<ProviderResult>) | undefined;
mock.module("resend", () => ({
  Resend: class {
    emails = {
      send: async (message: Envelope, options: { idempotencyKey: string }) => {
        calls.push({ message, key: options.idempotencyKey });
        if (dispatch) return dispatch();
        return reject
          ? { error: { message: "Test provider failure" }, data: null }
          : { data: { id: `provider-${calls.length}` }, error: null };
      },
    };
  },
}));

const { sendQuotation, tokenDigest } = await import("@/features/quotes/email");
const { redeemAccess } = await import("@/features/quotes/portal-access");
const { saveQuote, submitQuote } = await import("@/features/quotes/service");
const prefix = `mail-${crypto.randomUUID()}`;
const original = {
  transport: Bun.env.EMAIL_TRANSPORT,
  key: Bun.env.RESEND_API_KEY,
  recipient: Bun.env.EMAIL_TEST_RECIPIENT,
};
let actor: Actor, quoteId: string;

beforeAll(async () => {
  if (!new URL(Bun.env.DATABASE_URL!).pathname.endsWith("_test"))
    throw new Error("Email regression requires isolated test DB");
  delete Bun.env.EMAIL_TRANSPORT;
  Bun.env.RESEND_API_KEY = "provider-boundary-test-key";
  Bun.env.EMAIL_TEST_RECIPIENT = "delivered@resend.dev";
  const result = await createAuth(db).api.signUpEmail({
    body: {
      email: `${prefix}@example.test`,
      name: "Mail fixture rep",
      password: crypto.randomUUID(),
    },
  });
  actor = {
    id: result.user.id,
    email: result.user.email,
    name: result.user.name,
    role: "rep",
    customerId: null,
  };
  await db.insert(customers).values({
    id: prefix,
    name: "Mail fixture customer",
    email: `customer-${prefix}@example.test`,
    tier: "Gold",
  });
  await db.insert(products).values({
    id: prefix,
    name: "Mail fixture service",
    category: "Services",
    priceCents: 10000,
    costCents: 2000,
  });
  const draft = await saveQuote(
    {
      customerId: prefix,
      lines: [{ productId: prefix, quantity: 1, discountBps: 0 }],
      orderDiscountBps: 0,
    },
    actor,
  );
  quoteId = draft.id;
  await submitQuote(draft.id, draft.revision, actor);
});

afterAll(async () => {
  for (const [name, value] of Object.entries({
    EMAIL_TRANSPORT: original.transport,
    RESEND_API_KEY: original.key,
    EMAIL_TEST_RECIPIENT: original.recipient,
  })) {
    if (value === undefined) delete Bun.env[name];
    else Bun.env[name] = value;
  }
  if (quoteId) {
    await db.delete(deliveries).where(eq(deliveries.quoteId, quoteId));
    await db.delete(quoteAccess).where(eq(quoteAccess.quoteId, quoteId));
    await db.delete(auditEntries).where(eq(auditEntries.entityId, quoteId));
    await db.delete(quoteRevisions).where(eq(quoteRevisions.quoteId, quoteId));
    await db.delete(quotes).where(eq(quotes.id, quoteId));
  }
  await db.delete(products).where(eq(products.id, prefix));
  await db.delete(customers).where(eq(customers.id, prefix));
  if (actor) await db.delete(user).where(eq(user.id, actor.id));
  await closeDatabase();
});

describe("quotation mail provider boundary", () => {
  test("failed delivery is durable and retry keeps its operation key", async () => {
    reject = true;
    const failed = await sendQuotation(quoteId, actor);
    expect(failed.status).toBe("FAILED");
    const [before] = await db.select().from(quotes).where(eq(quotes.id, quoteId));
    expect(before!.status).toBe("APPROVED");
    reject = false;
    const delivered = await sendQuotation(quoteId, actor);
    expect(delivered.status).toBe("SENT");
    expect(calls).toHaveLength(2);
    expect(calls[0]!.key).toBe(calls[1]!.key);
    const message = calls[1]!.message;
    expect(message.from).toContain("DealFlow360");
    expect(message.to).toBe("delivered@resend.dev");
    expect(message.subject).toContain(before!.number);
    expect(message.text).toContain("\n\n");
    expect(message.text).toContain("/portal/access?token=");
    expect(message.text).toContain("24 hours");
    const [delivery] = await db
      .select()
      .from(deliveries)
      .where(eq(deliveries.id, delivered.deliveryId));
    expect(delivery!.attempts).toBe(2);
    expect(delivery!.encryptedPayload).not.toContain("/portal/access");
    await sendQuotation(quoteId, actor);
    expect(calls).toHaveLength(2);
  });
  test("replacement links rotate prior access and are rate limited", async () => {
    const oldLink = calls[1]!.message.text.match(/https?:\/\/[^\s]+/)![0];
    const oldToken = new URL(oldLink).searchParams.get("token")!;
    const redeemed = await redeemAccess(oldToken);
    expect(redeemed.quoteId).toBe(quoteId);
    await expect(sendQuotation(quoteId, actor, true)).rejects.toThrow("Wait one minute");
    await db
      .update(deliveries)
      .set({ createdAt: new Date(Date.now() - 61_000) })
      .where(eq(deliveries.quoteId, quoteId));
    await sendQuotation(quoteId, actor, true);
    expect(calls).toHaveLength(3);
    expect(calls[2]!.key).not.toBe(calls[1]!.key);
    const [old] = await db
      .select()
      .from(quoteAccess)
      .where(eq(quoteAccess.digest, await tokenDigest(oldToken)));
    expect(old!.revoked).toBe(true);
    const newLink = calls[2]!.message.text.match(/https?:\/\/[^\s]+/)![0];
    expect((await redeemAccess(new URL(newLink).searchParams.get("token")!)).quoteId).toBe(quoteId);
  });
  test("a late failed retry cannot downgrade accepted mail", async () => {
    const existing = await db.select().from(deliveries).where(eq(deliveries.quoteId, quoteId));
    const latest = existing.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]!;
    await db
      .update(deliveries)
      .set({ status: "PENDING", providerId: null, error: null, attempts: 0 })
      .where(eq(deliveries.id, latest.id));
    const firstEntered = Promise.withResolvers<void>(),
      secondEntered = Promise.withResolvers<void>();
    const firstResult = Promise.withResolvers<ProviderResult>(),
      secondResult = Promise.withResolvers<ProviderResult>();
    let entered = 0;
    dispatch = () => {
      entered += 1;
      if (entered === 1) {
        firstEntered.resolve();
        return firstResult.promise;
      }
      secondEntered.resolve();
      return secondResult.promise;
    };
    const first = sendQuotation(quoteId, actor);
    await firstEntered.promise;
    const second = sendQuotation(quoteId, actor);
    try {
      await secondEntered.promise;
      firstResult.resolve({ data: { id: "accepted-provider-operation" }, error: null });
      expect((await first).status).toBe("SENT");
      secondResult.resolve({ data: null, error: { message: "Late network failure" } });
      expect((await second).status).toBe("SENT");
      const [final] = await db.select().from(deliveries).where(eq(deliveries.id, latest.id));
      expect(final!.providerId).toBe("accepted-provider-operation");
      expect(final!.error).toBeNull();
      expect(final!.attempts).toBe(2);
    } finally {
      firstResult.resolve({ data: { id: "accepted-provider-operation" }, error: null });
      secondResult.resolve({ data: null, error: { message: "Late network failure" } });
      await Promise.allSettled([first, second]);
      dispatch = undefined;
    }
  });
});
