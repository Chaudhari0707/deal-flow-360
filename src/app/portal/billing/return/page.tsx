import { Suspense } from "react";

import { PortalBillingReturn } from "@/features/portal/portal-billing-return";
import { requireCustomerPortalView } from "@/features/portal/portal-page-access";
import { WorkspaceState } from "@/features/shell/workspace-state";

async function CustomerPortalBillingReturn() {
  await requireCustomerPortalView();
  return <PortalBillingReturn />;
}

export default function PortalBillingReturnPage() {
  return (
    <Suspense fallback={<WorkspaceState />}>
      <CustomerPortalBillingReturn />
    </Suspense>
  );
}
