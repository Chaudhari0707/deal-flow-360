import { eq } from "drizzle-orm";

import { createAuth } from "@/lib/auth/create-auth";
import { db } from "@/lib/db/connection";
import { profiles } from "@/lib/db/schema";
import type { Actor, Role } from "@/lib/domain/_types/domain";
import { DomainError } from "@/server/errors";

export async function requireActor(request: Request, roles?: Role[]): Promise<Actor> {
  const session = await createAuth(db).api.getSession({ headers: request.headers });
  if (!session) throw new DomainError("Please sign in to continue.", 401);
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, session.user.id));
  const actor: Actor = {
    customerId: profile?.customerId ?? null,
    email: session.user.email,
    id: session.user.id,
    name: session.user.name,
    role: profile?.role ?? "rep",
  };
  if (roles && !roles.includes(actor.role))
    throw new DomainError("Your role cannot perform this action.", 403);
  requireMutationOrigin(request);
  return actor;
}

export function requireMutationOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const expected = new URL(Bun.env.BETTER_AUTH_URL!).origin;
  if (request.headers.get("origin") !== expected)
    throw new DomainError("Request origin is not allowed.", 403);
}
