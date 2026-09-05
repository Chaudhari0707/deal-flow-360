/** Normalize an unsuccessful HTTP response without leaking JSON parser errors to the user. */
export async function assertBillingResponse(response: Response): Promise<void> {
  if (response.ok) return;
  const payload: unknown = await response.json().catch(() => null);
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const nested =
    record.error && typeof record.error === "object"
      ? (record.error as Record<string, unknown>)
      : {};
  const message = [record.error, nested.message, record.message, response.statusText].find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  throw new Error(message?.trim() ?? `Request failed (${response.status}). Refresh and try again.`);
}
