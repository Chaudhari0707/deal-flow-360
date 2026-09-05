"use client";

/** Send can return HTTP 200 with `{ status: "FAILED" }` when Resend rejects. */
export function assertQuoteAction<T extends { message?: string | null; status?: string }>(
  result: T,
): T {
  if (result.status === "FAILED")
    throw new Error(result.message ?? "Email delivery failed. Check sender configuration.");
  return result;
}
