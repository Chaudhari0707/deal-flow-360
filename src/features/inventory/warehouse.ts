import { eq, ne } from "drizzle-orm";
import { sql } from "drizzle-orm";

import { db } from "@/lib/db/connection";
import { warehouses } from "@/lib/db/schema/inventory";
import type { Actor } from "@/lib/domain/_types/domain";
import { audit } from "@/server/audit";
import { DomainError } from "@/server/errors";

export async function saveWarehouse(
  id: string | undefined,
  values: typeof warehouses.$inferInsert,
  actor: Actor,
) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`LOCK TABLE warehouses IN SHARE ROW EXCLUSIVE MODE`);
    const existing = await tx
      .select()
      .from(warehouses)
      .where(id ? ne(warehouses.id, id) : undefined);
    if (!id && existing.length >= 100)
      throw new DomainError("The local workspace supports up to 100 configured warehouses", 409);
    if (values.active && existing.filter((w) => w.active).length >= 3)
      throw new DomainError(
        "Pause an existing warehouse first. The demo planner supports three active warehouses.",
        409,
      );
    const [warehouse] = id
      ? await tx.update(warehouses).set(values).where(eq(warehouses.id, id)).returning()
      : await tx.insert(warehouses).values(values).returning();
    if (!warehouse) throw new DomainError("Warehouse not found", 404);
    await audit(
      tx,
      actor,
      warehouse.id,
      id ? "WAREHOUSE_UPDATED" : "WAREHOUSE_CREATED",
      "Warehouse configuration updated",
      values,
    );
    return warehouse;
  });
}
