"use client";

import { treaty } from "@elysiajs/eden";

import type { JsonTransport } from "@/lib/api/_types/client";
import type { Api } from "@/server/_types/api";

export const apiClient = treaty<Api>("", { keepDomain: true, parseDate: false });

function errorMessage(value: unknown) {
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  const nested =
    record.error && typeof record.error === "object"
      ? (record.error as Record<string, unknown>)
      : {};
  return [record.error, nested.message, record.message].find(
    (message): message is string => typeof message === "string" && message.trim().length > 0,
  );
}

export class HttpResponseError extends Error {
  readonly status: number;
  readonly value: unknown;

  constructor(status: number, statusText = "", value?: unknown, fallback?: string) {
    super(
      errorMessage(value)?.trim() ??
        fallback ??
        (statusText ? statusText.trim() : undefined) ??
        `Request failed (${status}). Refresh and try again.`,
    );
    this.name = "HttpResponseError";
    this.status = status;
    this.value = value;
  }
}

export function apiData<
  Result extends {
    data: unknown;
    error: { value: unknown } | null;
    response?: Response;
    status: number;
  },
>(
  result: Result,
  fallback?: string,
): JsonTransport<Exclude<NonNullable<Result["data"]>, Response>> {
  if (result.error || result.data === null || result.data === undefined || result.data === "")
    throw new HttpResponseError(
      result.status,
      result.response?.statusText,
      result.error?.value,
      fallback,
    );
  if (result.data instanceof Response)
    throw new HttpResponseError(result.status, "", undefined, fallback);
  return result.data as JsonTransport<Exclude<NonNullable<Result["data"]>, Response>>;
}
