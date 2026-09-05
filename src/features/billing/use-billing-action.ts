"use client";
import { useState } from "react";
import { useSWRConfig } from "swr";

import { assertBillingResponse } from "@/features/billing/response";
import { workspaceKey } from "@/features/shell/use-workspace";

export function useBillingAction() {
  const { mutate } = useSWRConfig();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function run(path: string, body: unknown, success: string) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/v1${path}`, {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      await assertBillingResponse(response);
      await mutate(workspaceKey);
      setMessage(success);
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Request failed");
      return false;
    } finally {
      setPending(false);
    }
  }
  return { error, message, pending, run };
}
