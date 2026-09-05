import { eq } from "drizzle-orm";

import { db } from "@/lib/db/connection";
import { customers, profiles, quotes } from "@/lib/db/schema";
import type { Actor } from "@/lib/domain/_types/domain";
import { audit } from "@/server/audit";
import { DomainError } from "@/server/errors";

export function databaseErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return;
  if ("code" in error && typeof error.code === "string") return error.code;
  return "cause" in error ? databaseErrorCode(error.cause) : undefined;
}

export async function deleteCatalogCustomer(customerId: string, actor: Actor) {
  if (!["manager", "admin"].includes(actor.role))
    throw new DomainError("Your role cannot delete customers", 403);
  try {
    return await db.transaction(async (tx) => {
      const [customer] = await tx
        .select()
        .from(customers)
        .where(eq(customers.id, customerId))
        .for("update");
      if (!customer) throw new DomainError("Customer not found", 404);
      const [quote] = await tx
        .select({ id: quotes.id })
        .from(quotes)
        .where(eq(quotes.customerId, customerId))
        .limit(1);
      const [profile] = await tx
        .select({ id: profiles.userId })
        .from(profiles)
        .where(eq(profiles.customerId, customerId))
        .limit(1);
      if (quote || profile)
        throw new DomainError(
          "This customer has quotations or a linked portal account and cannot be deleted.",
          409,
        );
      await tx.delete(customers).where(eq(customers.id, customerId));
      await audit(tx, actor, customerId, "CUSTOMER_DELETED", "Unused customer deleted");
      return customer;
    });
  } catch (error) {
    if (databaseErrorCode(error) === "23503")
      throw new DomainError("This customer has linked records and cannot be deleted.", 409);
    throw error;
  }
}
