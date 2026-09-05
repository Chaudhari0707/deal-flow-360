import { Suspense } from "react";

import { PortalOverview } from "@/features/portal/portal-overview";
import { requireCustomerPortalView } from "@/features/portal/portal-page-access";
import { WorkspaceState } from "@/features/shell/workspace-state";

async function CustomerPortalOverview() {
  await requireCustomerPortalView();
  return <PortalOverview />;
}

export default function PortalPage() {
  return (
    <Suspense fallback={<WorkspaceState />}>
      <CustomerPortalOverview />
    </Suspense>
  );
}
