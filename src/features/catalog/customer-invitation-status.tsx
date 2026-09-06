"use client";

import { useState } from "react";
import useSWR from "swr";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { apiClient, apiData, HttpResponseError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

/** State reads as a square marker plus plain text — never a coloured pill. */
function marker(tone: "flag" | "pending" | "settled") {
  if (tone === "settled") return "bg-ink-positive";
  return tone === "flag" ? "bg-ink-risk" : "bg-foreground/40";
}

export function CustomerInvitationStatus({ id }: { id: string }) {
  const endpoint = apiClient.api.v1.customers({ id }).invitation;
  const { data, error, mutate } = useSWR(`/api/v1/customers/${id}/invitation`, async () =>
    apiData(await endpoint.get()),
  );
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState("");
  if (error instanceof HttpResponseError && [403, 404].includes(error.status)) return null;
  const tone = data?.status === "SENT" ? "settled" : data || error ? "flag" : "pending";
  return (
    <div className="flex flex-col items-start gap-4 border-t border-border pt-4">
      <div className="flex items-baseline gap-2.5">
        <span aria-hidden className={cn("size-1.5 shrink-0 translate-y-px", marker(tone))} />
        <p role="status" className="text-sm text-foreground">
          {data?.status === "SENT"
            ? "Welcome email accepted by provider."
            : data
              ? "Customer login saved. Welcome email needs attention."
              : error
                ? "Unable to load welcome email status."
                : "Checking welcome email…"}
        </p>
      </div>
      {(failure || data?.message) && (
        <Alert variant="destructive">
          <AlertDescription>{failure || data?.message}</AlertDescription>
        </Alert>
      )}
      {data && data.status !== "SENT" && (
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            setFailure("");
            try {
              apiData(await endpoint.retry.post());
              await mutate();
            } catch (e) {
              setFailure(e instanceof Error ? e.message : "Retry failed");
            } finally {
              setPending(false);
            }
          }}
        >
          {pending ? "Sending…" : "Retry welcome email"}
        </Button>
      )}
    </div>
  );
}
