import { Suspense } from "react";

import { FulfillmentOrderScreen } from "@/features/inventory/fulfillment-order-screen";
import { WorkspaceState } from "@/features/shell/workspace-state";

async function Order({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FulfillmentOrderScreen id={id} />;
}

export default function FulfillmentOrderPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<WorkspaceState />}>
      <Order params={params} />
    </Suspense>
  );
}
