import { Suspense } from "react";

import { PortalBilling } from "@/features/portal/portal-billing";
import { requireCustomerPortalView } from "@/features/portal/portal-page-access";
import { WorkspaceState } from "@/features/shell/workspace-state";

async function CustomerPortalBilling() {
  await requireCustomerPortalView();
  return <PortalBilling />;
}

export default function PortalBillingPage() {
  return (
    <Suspense fallback={<WorkspaceState />}>
      <CustomerPortalBilling />
    </Suspense>
  );
}
