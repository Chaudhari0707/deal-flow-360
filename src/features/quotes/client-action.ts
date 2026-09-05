"use client";

export async function quoteRequest<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    /* An upstream error may contain HTML or no body. */
  }
  if (!response.ok || data === null)
    throw new Error(
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : "The action failed. Refresh and try again.",
    );
  return data as T;
}
