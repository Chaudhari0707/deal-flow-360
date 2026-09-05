import type { DbTransaction } from "@/lib/db/_types/database";
import { auditEntries } from "@/lib/db/schema";
import type { Actor } from "@/lib/domain/_types/domain";

export async function audit(
  tx: DbTransaction,
  actor: Actor,
  entityId: string,
  action: string,
  reason: string,
  detail?: Record<string, unknown>,
) {
  await tx.insert(auditEntries).values({
    id: crypto.randomUUID(),
    actorId: actor.id,
    actorName: actor.name,
    entityId,
    action,
    reason,
    detail,
  });
}
