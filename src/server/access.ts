import { eq } from "drizzle-orm";
import { Elysia } from "elysia";

import { createAuth, trustedOrigins } from "@/lib/auth/create-auth";
import { db } from "@/lib/db/connection";
import { profiles } from "@/lib/db/schema";
import type { Actor, Role } from "@/lib/domain/_types/domain";
import { DomainError } from "@/server/errors";

const auth = createAuth(db);

export async function requireActor(request: Request, roles?: Role[]): Promise<Actor> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw new DomainError("Please sign in to continue.", 401);
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, session.user.id));
  const actor: Actor = {
    customerId: profile?.customerId ?? null,
    email: session.user.email,
    id: session.user.id,
    name: session.user.name,
    role: profile?.role ?? "rep",
    mustChangePassword: profile?.mustChangePassword ?? false,
  };
  if (roles && !roles.includes(actor.role))
    throw new DomainError("Your role cannot perform this action.", 403);
  requireMutationOrigin(request);
  return actor;
}

export function requireMutationOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  const baseURL = Bun.env.BETTER_AUTH_URL;
  if (!origin || !baseURL || !trustedOrigins(baseURL).includes(origin))
    throw new DomainError("Request origin is not allowed.", 403);
}

export const actorContext = new Elysia({ name: "actor-context" }).macro({
  authorize(roles: true | Role[]) {
    return {
      detail: { security: [{ SessionCookie: [] }] },
      resolve: async ({ request }) => {
        const actor = await requireActor(request, roles === true ? undefined : roles);
        if (actor.mustChangePassword && roles !== true)
          throw new DomainError("Change your temporary password before continuing.", 403);
        return { actor };
      },
    };
  },
});
