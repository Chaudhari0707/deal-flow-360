import { describe, expect, test } from "bun:test";

import Stripe from "stripe";

import { stripePaymentKeys } from "@/features/billing/stripe-keys";

describe("stripe payment ledger keys", () => {
  test("keeps operationKey and reference within the 100-character API bound", () => {
    const short = stripePaymentKeys("cs_test_a1b2c3");
    expect(short.operationKey.length).toBeLessThanOrEqual(100);
    expect(short.reference.length).toBeLessThanOrEqual(100);
    expect(short.operationKey.startsWith("stripe:")).toBe(true);
    expect(short.reference).toBe("cs_test_a1b2c3");

    const longId = `cs_test_${"x".repeat(120)}`;
    const long = stripePaymentKeys(longId);
    expect(long.operationKey.length).toBeLessThanOrEqual(100);
    expect(long.reference.length).toBeLessThanOrEqual(100);
    expect(long.operationKey).not.toBe(long.reference);
  });

  test("is stable for the same session id", () => {
    const first = stripePaymentKeys("cs_test_stable");
    const second = stripePaymentKeys("cs_test_stable");
    expect(first).toEqual(second);
  });
});

describe("stripe webhook signature verification", () => {
  test("accepts a payload signed with the matching secret and rejects a wrong secret", async () => {
    const secret = "whsec_test_dealflow_local";
    const payload = JSON.stringify({
      id: "evt_test_1",
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_verify",
          object: "checkout.session",
          payment_status: "paid",
          metadata: { invoiceId: "inv_1", actorId: "user_1", customerId: "cus_1" },
        },
      },
    });
    const stripe = new Stripe("sk_test_placeholder");
    const header = await stripe.webhooks.generateTestHeaderStringAsync({ payload, secret });
    const event = await stripe.webhooks.constructEventAsync(payload, header, secret);
    expect(event.type).toBe("checkout.session.completed");
    await expect(
      stripe.webhooks.constructEventAsync(payload, header, "whsec_wrong"),
    ).rejects.toThrow();
  });
});
