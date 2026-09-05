import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { portalIdentity } from "@/features/quotes/portal-access";
import { DomainError } from "@/server/errors";

export async function requireCustomerPortalView() {
  const requestHeaders = await headers();
  try {
    await portalIdentity(
      new Request(`${Bun.env.BETTER_AUTH_URL}/portal`, { headers: requestHeaders }),
    );
  } catch (error) {
    if (error instanceof DomainError && error.status === 401) redirect("/login");
    if (error instanceof DomainError && error.status === 403) redirect("/dashboard");
    throw error;
  }
}
