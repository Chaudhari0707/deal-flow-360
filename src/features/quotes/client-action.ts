"use client";

export async function quoteRequest<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data.error === "string" ? data.error : "The action failed. Refresh and try again.",
    );
  return data as T;
}
