import { and, eq, sql } from "drizzle-orm";
import { Resend } from "resend";

import type { CatalogCustomerInput } from "@/features/catalog/_types/catalog";
import { customerEmailError } from "@/features/catalog/customer-email-error";
import { databaseErrorCode } from "@/features/catalog/customer-lifecycle";
import { senderAddress } from "@/features/quotes/sender-address";
import { createAuth } from "@/lib/auth/create-auth";
import { db } from "@/lib/db/connection";
import { customerInvitations, customers, profiles, user } from "@/lib/db/schema";
import type { Actor } from "@/lib/domain/_types/domain";
import { can } from "@/lib/domain/permissions";
import { open, seal } from "@/lib/email/sealed-payload";
import { audit } from "@/server/audit";
import { DomainError } from "@/server/errors";

function publicDelivery(row: typeof customerInvitations.$inferSelect) {
  return { id: row.id, status: row.status, message: row.error };
}

async function invitationFor(customerId: string, actor: Actor) {
  if (!can(actor.role, "customers"))
    throw new DomainError("Your role cannot manage customer invitations", 403);
  const [invitation] = await db
    .select()
    .from(customerInvitations)
    .where(eq(customerInvitations.customerId, customerId));
  if (!invitation) throw new DomainError("No onboarding invitation exists for this customer", 404);
  if (actor.role === "rep" && invitation.createdBy !== actor.id)
    throw new DomainError(
      "Only the creating representative or a manager can retry this invitation",
      403,
    );
  return invitation;
}

export async function customerInvitation(customerId: string, actor: Actor) {
  return publicDelivery(await invitationFor(customerId, actor));
}

export async function sendCustomerInvitation(customerId: string, actor: Actor) {
  const invitation = await invitationFor(customerId, actor);
  if (invitation.status === "SENT") return publicDelivery(invitation);
  if (!invitation.encryptedPayload)
    throw new DomainError(
      "The customer has already changed their password; the temporary password cannot be resent",
      409,
    );
  // Resend deduplicates for 24 hours. Beyond that window an uncertain send must
  // not be replayed automatically with an expired provider idempotency key.
  if (Date.now() - invitation.createdAt.getTime() > 23 * 3600000)
    throw new DomainError(
      "The invitation retry window has expired. Contact an administrator for account recovery.",
      409,
    );
  const [customer] = await db.select().from(customers).where(eq(customers.id, customerId));
  if (customer?.email !== invitation.recipient)
    throw new DomainError(
      "The login email changed; this original invitation cannot be resent",
      409,
    );
  let error: string | null = null;
  let providerId: string | null = null;
  try {
    if (!Bun.env.RESEND_API_KEY) throw { name: "missing_api_key" };
    const envelope = JSON.parse(await open(invitation.encryptedPayload)) as {
      from: string;
      to: string;
      subject: string;
      text: string;
    };
    const result = await new Resend(Bun.env.RESEND_API_KEY).emails.send(envelope, {
      idempotencyKey: `customer-invitation-${invitation.id}`,
    });
    if (result.error) throw result.error;
    if (!result.data?.id) throw new Error("Provider did not accept email");
    providerId = result.data.id;
  } catch (cause) {
    error = customerEmailError(cause);
  }
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(customerInvitations)
      .set({
        status: error
          ? sql`case when ${customerInvitations.status} = 'SENT' then 'SENT' else 'FAILED' end`
          : "SENT",
        error: error
          ? sql`case when ${customerInvitations.status} = 'SENT' then null else ${error} end`
          : null,
        providerId: providerId ?? sql`${customerInvitations.providerId}`,
        attempts: sql`${customerInvitations.attempts} + 1`,
      })
      .where(eq(customerInvitations.id, invitation.id))
      .returning();
    await audit(
      tx,
      actor,
      customerId,
      error ? "CUSTOMER_INVITATION_FAILED" : "CUSTOMER_INVITATION_SENT",
      error ?? "Welcome email accepted by provider",
    );
    return publicDelivery(updated!);
  });
}

export async function createCustomerWithLogin(input: CatalogCustomerInput, actor: Actor) {
  if (!can(actor.role, "customerCreate"))
    throw new DomainError("Your role cannot create customers", 403);
  input = { ...input, name: input.name.trim(), email: input.email.trim().toLowerCase() };
  const password = crypto.randomUUID() + crypto.randomUUID();
  const envelope = {
    from: senderAddress(Bun.env.EMAIL_FROM ?? "DealFlow360 <onboarding@resend.dev>"),
    to: input.email,
    subject: "Your DealFlow360 customer portal login",
    text: `Hello ${input.name},\n\nYour customer portal account is ready.\nSign in: ${new URL("/login", Bun.env.BETTER_AUTH_URL!).href}\nEmail: ${input.email}\nTemporary password: ${password}\n\nYou must choose a new password before opening your customer portal. Do not share this password.\n\nDealFlow360`,
  };
  const encryptedPayload = await seal(JSON.stringify(envelope));
  let customer;
  try {
    customer = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${input.email}, 0))`);
      const [existingUser] = await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, input.email));
      const [existingCustomer] = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.email, input.email));
      if (existingUser || existingCustomer)
        throw new DomainError(
          "That email already has a customer or login account. Use a different email.",
          409,
        );
      const created = await createAuth(tx, true).api.signUpEmail({
        body: { email: input.email, name: input.name, password },
      });
      const [persisted] = await tx
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.email, input.email), eq(user.id, created.user.id)));
      if (!persisted) throw new DomainError("That email already has a login account.", 409);
      const [record] = await tx
        .insert(customers)
        .values({ id: crypto.randomUUID(), ...input })
        .returning();
      await tx.insert(profiles).values({
        userId: persisted.id,
        role: "customer",
        customerId: record!.id,
        mustChangePassword: true,
      });
      await tx.insert(customerInvitations).values({
        id: crypto.randomUUID(),
        customerId: record!.id,
        userId: persisted.id,
        createdBy: actor.id,
        recipient: input.email,
        encryptedPayload,
      });
      await audit(tx, actor, record!.id, "CUSTOMER_CREATED", "Customer and portal login created");
      return record!;
    });
  } catch (error) {
    if (databaseErrorCode(error) === "23505" || databaseErrorCode(error) === "23503")
      throw new DomainError("That email already has a login account.", 409);
    throw error;
  }
  return { ...customer, invitation: await sendCustomerInvitation(customer.id, actor) };
}
