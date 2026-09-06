"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/features/shell/page-header";
import { WorkspaceState } from "@/features/shell/workspace-state";
import { apiClient, apiData, HttpResponseError } from "@/lib/api/client";

export function PortalInvoiceCheckout({ invoiceId }: { invoiceId: string }) {
  const [error, setError] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const stripePromise = useMemo(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setError("");
      try {
        const result = apiData(
          await apiClient.api.v1.portal.billing.invoices({ id: invoiceId }).checkout.post(),
        );
        if (cancelled) return;
        setPublishableKey(result.publishableKey);
        setClientSecret(result.clientSecret);
      } catch (cause) {
        if (cancelled) return;
        setError(
          cause instanceof HttpResponseError
            ? cause.message
            : "Unable to start checkout. Try again or contact finance.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  return (
    <>
      <PageHeader
        title="Pay invoice"
        description="Complete payment inside this page. Your invoice is marked paid only after Stripe confirms the charge."
      />
      <div className="mb-4">
        <Button nativeButton={false} variant="outline" render={<Link href="/portal/billing" />}>
          Back to invoices
        </Button>
      </div>
      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Checkout unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {!error && (!clientSecret || !stripePromise) ? <WorkspaceState /> : null}
      {clientSecret && stripePromise ? (
        <div id="stripe-checkout" className="min-h-96 rounded-lg border bg-background p-2">
          <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      ) : null}
    </>
  );
}
