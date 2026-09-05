import { Suspense } from "react";

import { PortalAccess } from "@/features/portal/portal-access";
import { WorkspaceState } from "@/features/shell/workspace-state";
export default function PortalAccessPage() {
  return (
    <Suspense fallback={<WorkspaceState />}>
      <PortalAccess />
    </Suspense>
  );
}
