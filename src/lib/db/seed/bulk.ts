import { and, eq, sql } from "drizzle-orm";

import { createAuth } from "@/lib/auth/create-auth";
import type { BulkSeedOptions } from "@/lib/db/_types/bulk-seed";
import type { Database } from "@/lib/db/_types/database";
import * as s from "@/lib/db/schema";
import { bulkSeedCounts, validateBulkOptions } from "@/lib/db/seed/bulk-options";
import { seedBulkScenario } from "@/lib/db/seed/bulk-scenario";

/** Add complete synthetic graphs atomically. Retrying a batch never overwrites edited fixtures. */
export async function seedBulkData(database: Database, input: BulkSeedOptions) {
  const options = validateBulkOptions(input);
  const password = Bun.env.DEMO_PASSWORD;
  if (!password || password.length < 12)
    throw new Error(
      "Set DEMO_PASSWORD to at least 12 characters in your ignored local environment",
    );
  return database.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`bulk-seed:${options.batch}`}, 0))`,
    );
    const staff: Record<string, string> = {};
    for (const role of ["rep", "finance", "ops"] as const) {
      const [actor] = await tx
        .select({ id: s.user.id })
        .from(s.user)
        .innerJoin(s.profiles, eq(s.profiles.userId, s.user.id))
        .where(and(eq(s.user.email, `${role}@dealflow360.demo`), eq(s.profiles.role, role)));
      if (!actor)
        throw new Error(
          `Missing demo ${role} account. Run bun run db:seed first with DEMO_PASSWORD configured.`,
        );
      staff[role] = actor.id;
    }
    const auth = createAuth(tx, true);
    let added = 0;
    for (let index = 0; index < options.count; index++) {
      const key = String(index + 1).padStart(4, "0");
      const prefix = `bulk-${options.batch}-${key}`;
      const markerId = `${prefix}-complete`;
      const [marker] = await tx
        .select({ id: s.auditEntries.id })
        .from(s.auditEntries)
        .where(
          and(eq(s.auditEntries.id, markerId), eq(s.auditEntries.action, "BULK_SEED_COMPLETE")),
        );
      if (marker) continue;
      const email = `${prefix}@example.test`;
      const [existingUser] = await tx
        .select({ id: s.user.id })
        .from(s.user)
        .where(eq(s.user.email, email));
      const [existingCustomer] = await tx
        .select({ id: s.customers.id })
        .from(s.customers)
        .where(eq(s.customers.email, email));
      if (existingUser || existingCustomer)
        throw new Error(
          "Sample email already belongs to an existing record. Choose a different --batch; no data was overwritten.",
        );
      const [customer] = await tx
        .insert(s.customers)
        .values({
          id: prefix,
          name: `Sample ${options.batch} customer ${key}`,
          email,
          tier: ["Gold", "Silver", "Bronze"][index % 3]!,
          team: index % 2 ? "Growth" : "Enterprise",
        })
        .returning();
      const result = await auth.api.signUpEmail({
        body: { email, name: customer!.name, password },
      });
      const [persisted] = await tx
        .select({ id: s.user.id })
        .from(s.user)
        .where(and(eq(s.user.email, email), eq(s.user.id, result.user.id)));
      if (!persisted)
        throw new Error("Sample credential creation could not be verified; batch rolled back");
      await tx
        .insert(s.profiles)
        .values({ userId: persisted.id, role: "customer", customerId: prefix });
      const warehouseId = `bulk-${options.batch}-warehouse-${(index % 3) + 1}`;
      await tx
        .insert(s.warehouses)
        .values({
          id: warehouseId,
          name: `Sample ${options.batch} depot ${(index % 3) + 1}`,
          shippingWeight: 100 + (index % 3) * 20,
        })
        .onConflictDoNothing();
      await seedBulkScenario(
        tx,
        options,
        index,
        {
          repId: staff.rep!,
          financeId: staff.finance!,
          opsId: staff.ops!,
          customerUserId: persisted.id,
        },
        customer!,
      );
      await tx.insert(s.auditEntries).values({
        id: markerId,
        entityId: prefix,
        actorName: "Local bulk seeder",
        action: "BULK_SEED_COMPLETE",
        reason: "Synthetic scenario v1",
        detail: { batch: options.batch, asOf: options.asOf },
      });
      added++;
    }
    return {
      batch: options.batch,
      addedScenarios: added,
      skippedScenarios: options.count - added,
      added: bulkSeedCounts(added),
    };
  });
}
