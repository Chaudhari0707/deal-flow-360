import { Suspense } from "react";

import { PortalDetail } from "@/features/portal/portal-detail";
import { WorkspaceState } from "@/features/shell/workspace-state";

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PortalDetail id={id} />;
}
export default function PortalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<WorkspaceState />}>
      <Detail params={params} />
    </Suspense>
  );
}
