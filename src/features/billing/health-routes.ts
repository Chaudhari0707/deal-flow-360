import { eq, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { db } from "@/lib/db/connection";
import { auditEntries, quotes, settings } from "@/lib/db/schema/commerce";
import { actorContext } from "@/server/access";
import { audit } from "@/server/audit";
import { DomainError } from "@/server/errors";

export const healthRoutes = new Elysia({ name: "health-rules" })
  .use(actorContext)
  .post(
    "/health/rules",
    async ({ actor, body }) => {
      return db.transaction(async (tx) => {
        const [result] = await tx
          .insert(settings)
          .values({ id: "health", value: body })
          .onConflictDoUpdate({ set: { value: body }, target: settings.id })
          .returning();
        await audit(
          tx,
          actor,
          "health",
          "HEALTH_RULES_CHANGED",
          "Updated attention thresholds",
          body,
        );
        return result;
      });
    },
    {
      authorize: ["admin", "manager"],
      body: t.Object({
        anomalyBps: t.Number({ maximum: 10000, minimum: 0, multipleOf: 1 }),
        historyDays: t.Number({ maximum: 365, minimum: 1, multipleOf: 1 }),
        approvalDays: t.Number({ maximum: 60, minimum: 1, multipleOf: 1 }),
        overdueDays: t.Number({ maximum: 60, minimum: 1, multipleOf: 1 }),
        staleDays: t.Number({ maximum: 90, minimum: 1, multipleOf: 1 }),
      }),
    },
  )
  .post(
    "/health/nudge",
    async ({ actor, body }) => {
      return db.transaction(async (tx) => {
        const [quote] = await tx.select().from(quotes).where(eq(quotes.id, body.quoteId));
        if (!quote) throw new DomainError("Quotation not found", 404);
        if (actor.role === "rep" && quote.ownerId !== actor.id)
          throw new DomainError("You cannot nudge another representative's deal", 403);
        const id = `nudge:${actor.id}:${body.operationKey}`;
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${id}, 0))`);
        const [existing] = await tx.select().from(auditEntries).where(eq(auditEntries.id, id));
        if (existing && (existing.entityId !== quote.id || existing.reason !== body.reason))
          throw new DomainError("Nudge identity was already used", 409);
        await tx
          .insert(auditEntries)
          .values({
            action: "HEALTH_NUDGE",
            actorId: actor.id,
            actorName: actor.name,
            detail: { ownerId: quote.ownerId },
            entityId: quote.id,
            id,
            reason: body.reason,
          })
          .onConflictDoNothing();
        return { status: "RECORDED" };
      });
    },
    {
      authorize: ["admin", "manager", "finance", "rep"],
      body: t.Object({
        operationKey: t.String({ minLength: 8, maxLength: 100 }),
        quoteId: t.String({ minLength: 1, maxLength: 100 }),
        reason: t.String({ minLength: 3, maxLength: 500 }),
      }),
    },
  );
