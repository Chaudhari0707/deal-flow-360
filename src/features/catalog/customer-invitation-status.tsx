"use client";

import { useState } from "react";
import useSWR from "swr";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { apiClient, apiData, HttpResponseError } from "@/lib/api/client";

export function CustomerInvitationStatus({ id }: { id: string }) {
  const endpoint = apiClient.api.v1.customers({ id }).invitation;
  const { data, error, mutate } = useSWR(`/api/v1/customers/${id}/invitation`, async () =>
    apiData(await endpoint.get()),
  );
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState("");
  if (error instanceof HttpResponseError && [403, 404].includes(error.status)) return null;
  return (
    <div className="space-y-2">
      <p role="status" className="text-sm">
        {data?.status === "SENT"
          ? "Welcome email accepted by provider."
          : data
            ? "Customer login saved. Welcome email needs attention."
            : error
              ? "Unable to load welcome email status."
              : "Checking welcome email…"}
      </p>
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
