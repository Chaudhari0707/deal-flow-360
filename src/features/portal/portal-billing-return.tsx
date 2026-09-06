"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/features/shell/page-header";

export function PortalBillingReturn() {
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  return (
    <>
      <PageHeader
        title="Payment submitted"
        description="Stripe is confirming your payment. The invoice updates when the webhook records it in the ledger."
      />
      <Alert>
        <CheckCircle2 />
        <AlertTitle>Thanks — we received your Checkout session</AlertTitle>
        <AlertDescription>
          {sessionId
            ? "You can return to invoices in a moment. If the balance still shows unpaid, wait a few seconds and refresh."
            : "Return to invoices to review outstanding balances."}
        </AlertDescription>
      </Alert>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button nativeButton={false} render={<Link href="/portal/billing" />}>
          View invoices
        </Button>
        <Button nativeButton={false} variant="outline" render={<Link href="/portal" />}>
          Quotations
        </Button>
      </div>
    </>
  );
}
