import { type ReactNode, Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { WorkspaceShell } from "@/features/shell/workspace-shell";
import { WorkspaceState } from "@/features/shell/workspace-state";
import { requireActor } from "@/server/access";
import { DomainError } from "@/server/errors";

async function AuthenticatedWorkspace({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  let actor;
  try {
    actor = await requireActor(
      new Request(`${Bun.env.BETTER_AUTH_URL}/dashboard`, { headers: requestHeaders }),
    );
  } catch (error) {
    if (error instanceof DomainError && error.status === 401) redirect("/login");
    throw error;
  }
  if (actor.mustChangePassword) redirect("/change-password");
  if (actor.role === "customer") redirect("/portal");
  return <WorkspaceShell actor={actor}>{children}</WorkspaceShell>;
}

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<WorkspaceState />}>
      <AuthenticatedWorkspace>{children}</AuthenticatedWorkspace>
    </Suspense>
  );
}
