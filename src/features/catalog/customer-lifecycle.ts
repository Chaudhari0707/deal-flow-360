import { eq } from "drizzle-orm";

import { db } from "@/lib/db/connection";
import { customerInvitations, customers, profiles, quotes, user } from "@/lib/db/schema";
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
      const linkedProfiles = await tx
        .select({ userId: profiles.userId, role: profiles.role })
        .from(profiles)
        .where(eq(profiles.customerId, customerId))
        .for("update");
      if (quote)
        throw new DomainError(
          "This customer has quotations, billing history, or other linked records and cannot be deleted.",
          409,
        );
      if (
        linkedProfiles.length > 1 ||
        linkedProfiles.some((profile) => profile.role !== "customer")
      )
        throw new DomainError(
          "This customer has multiple or non-customer logins and cannot be deleted automatically.",
          409,
        );

      const [invitation] = await tx
        .select({ userId: customerInvitations.userId })
        .from(customerInvitations)
        .where(eq(customerInvitations.customerId, customerId))
        .for("update");
      const profile = linkedProfiles[0];
      if (profile && invitation && profile.userId !== invitation.userId)
        throw new DomainError(
          "This customer has inconsistent portal records and cannot be deleted automatically.",
          409,
        );

      const portalUserId = profile?.userId ?? invitation?.userId;
      if (portalUserId) {
        await tx.delete(customerInvitations).where(eq(customerInvitations.customerId, customerId));
        await tx.delete(profiles).where(eq(profiles.userId, portalUserId));
        await tx.delete(user).where(eq(user.id, portalUserId));
      }
      await tx.delete(customers).where(eq(customers.id, customerId));
      await audit(
        tx,
        actor,
        customerId,
        "CUSTOMER_DELETED",
        portalUserId ? "Unused customer and portal login deleted" : "Unused customer deleted",
      );
      return customer;
    });
  } catch (error) {
    if (databaseErrorCode(error) === "23503")
      throw new DomainError("This customer has linked records and cannot be deleted.", 409);
    throw error;
  }
}
