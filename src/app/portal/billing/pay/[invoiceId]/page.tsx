import { Suspense } from "react";

import { PortalInvoiceCheckout } from "@/features/portal/portal-invoice-checkout";
import { requireCustomerPortalView } from "@/features/portal/portal-page-access";
import { WorkspaceState } from "@/features/shell/workspace-state";

async function CustomerPortalCheckout({ invoiceId }: { invoiceId: string }) {
  await requireCustomerPortalView();
  return <PortalInvoiceCheckout invoiceId={invoiceId} />;
}

export default async function PortalPayInvoicePage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  return (
    <Suspense fallback={<WorkspaceState />}>
      <CustomerPortalCheckout invoiceId={invoiceId} />
    </Suspense>
  );
}
