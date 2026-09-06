import { type ReactNode, Suspense } from "react";
import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";

import { WorkspaceState } from "@/features/shell/workspace-state";
import type { Permission } from "@/lib/domain/_types/permissions";
import { can } from "@/lib/domain/permissions";
import { requireActor } from "@/server/access";
import { DomainError } from "@/server/errors";

async function AuthorizedSurface({
  children,
  permission,
}: {
  children: ReactNode;
  permission: Permission;
}) {
  let actor;
  try {
    actor = await requireActor(
      new Request(`${Bun.env.BETTER_AUTH_URL}/`, { headers: await headers() }),
    );
  } catch (error) {
    if (error instanceof DomainError && error.status === 401) redirect("/login");
    throw error;
  }
  if (actor.mustChangePassword) redirect("/change-password");
  if (actor.role === "customer") redirect("/portal");
  if (!can(actor.role, permission)) forbidden();
  return children;
}

export function ProtectedSurface(props: { children: ReactNode; permission: Permission }) {
  return (
    <Suspense fallback={<WorkspaceState />}>
      <AuthorizedSurface {...props} />
    </Suspense>
  );
}
