"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { WorkspaceState } from "@/features/shell/workspace-state";
import { fetchJson } from "@/lib/swr/fetcher";

export function PortalAccess() {
  const started = useRef(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.search).get("token");
    // Remove the bearer from browser history immediately after reading it.
    window.history.replaceState(null, "", "/portal/access");
    async function redeem() {
      if (!token) throw new Error("Missing quotation access token");
      return fetchJson<{ quoteId: string }>("/api/v1/portal/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
    }
    void redeem()
      .then((result) => {
        window.location.replace(`/portal/${encodeURIComponent(result.quoteId)}`);
      })
      .catch(() => {
        setError(true);
      });
  }, []);
  return error ? (
    <Alert variant="destructive">
      <AlertTitle>This quotation link is unavailable</AlertTitle>
      <AlertDescription>
        It may have expired or already been used. Ask your account manager for a fresh link, or sign
        in with your customer account.
        <div className="mt-4">
          <Button nativeButton={false} render={<Link href="/login" />}>
            Sign in
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  ) : (
    <WorkspaceState />
  );
}
