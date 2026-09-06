"use client";

import { WorkspaceState } from "@/features/shell/workspace-state";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <div className="p-4 md:p-6 lg:p-8">
      <WorkspaceState error={true} retry={retry} />
    </div>
  );
}
