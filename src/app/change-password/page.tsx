import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ChangePasswordForm } from "@/features/identity/change-password-form";
import { WorkspaceState } from "@/features/shell/workspace-state";
import { requireActor } from "@/server/access";
import { DomainError } from "@/server/errors";

async function PasswordSetup() {
  let actor;
  try {
    actor = await requireActor(
      new Request(`${Bun.env.BETTER_AUTH_URL}/change-password`, { headers: await headers() }),
    );
  } catch (error) {
    if (error instanceof DomainError && error.status === 401) redirect("/login");
    throw error;
  }
  if (!actor.mustChangePassword) redirect(actor.role === "customer" ? "/portal" : "/dashboard");
  return <ChangePasswordForm />;
}

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={<WorkspaceState />}>
      <PasswordSetup />
    </Suspense>
  );
}
