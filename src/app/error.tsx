"use client";

import { WorkspaceState } from "@/features/shell/workspace-state";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <div className="p-6">
      <WorkspaceState error={true} retry={retry} />
    </div>
  );
}
