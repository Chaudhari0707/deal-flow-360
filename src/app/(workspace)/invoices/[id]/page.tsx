import { Suspense } from "react";

import { InvoiceWorkspace } from "@/features/billing/invoice-workspace";
import { WorkspaceState } from "@/features/shell/workspace-state";

async function InvoiceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InvoiceWorkspace initialId={id} />;
}
export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<WorkspaceState />}>
      <InvoiceDetail params={params} />
    </Suspense>
  );
}
