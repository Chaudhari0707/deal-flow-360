/** Stable ledger keys derived from a Stripe Checkout Session id (maxLength 100). */
export function stripePaymentKeys(sessionId: string) {
  if (!sessionId.trim()) throw new Error("Stripe session id is required");
  const digest = new Bun.CryptoHasher("sha256").update(sessionId).digest("hex");
  const operationKey = `stripe:${digest.slice(0, 40)}`;
  const reference = sessionId.length <= 100 ? sessionId : `stripe:${digest}`;
  return { operationKey, reference };
}
