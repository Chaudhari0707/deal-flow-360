import { Suspense } from "react";
import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";

import { WorkspaceState } from "@/features/shell/workspace-state";
import { can } from "@/lib/domain/permissions";
import { requireActor } from "@/server/access";
import { DomainError } from "@/server/errors";

async function LegacyInventory() {
  let actor;
  try {
    actor = await requireActor(
      new Request(`${Bun.env.BETTER_AUTH_URL}/inventory`, { headers: await headers() }),
    );
  } catch (error) {
    if (error instanceof DomainError && error.status === 401) redirect("/login");
    throw error;
  }
  if (actor.mustChangePassword) redirect("/change-password");
  if (!can(actor.role, "stockRead")) forbidden();
  return redirect(actor.role === "admin" ? "/settings" : "/fulfillment");
}
export default function InventoryPage() {
  return (
    <Suspense fallback={<WorkspaceState />}>
      <LegacyInventory />
    </Suspense>
  );
}
