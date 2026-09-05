import { Suspense } from "react";

import { PortalDetail } from "@/features/portal/portal-detail";
import { requireCustomerPortalView } from "@/features/portal/portal-page-access";
import { WorkspaceState } from "@/features/shell/workspace-state";

async function CustomerPortalDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireCustomerPortalView();
  const { id } = await params;
  return <PortalDetail id={id} />;
}

export default function PortalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<WorkspaceState />}>
      <CustomerPortalDetail params={params} />
    </Suspense>
  );
}
