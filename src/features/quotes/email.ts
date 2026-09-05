import { and, desc, eq, sql } from "drizzle-orm";
import { Resend } from "resend";

import { db } from "@/lib/db/connection";
import { customers, deliveries, quoteAccess, quotes } from "@/lib/db/schema";
import type { Actor } from "@/lib/domain/_types/domain";
import { audit } from "@/server/audit";
import { DomainError } from "@/server/errors";

export async function tokenDigest(token: string) {
  return new Bun.CryptoHasher("sha256").update(token).digest("hex");
}

async function payloadKey() {
  if (!Bun.env.BETTER_AUTH_SECRET || Bun.env.BETTER_AUTH_SECRET.length < 32)
    throw new DomainError("Email access requires configured authentication", 503);
  const key = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(Bun.env.BETTER_AUTH_SECRET!),
  );
  return crypto.subtle.importKey("raw", key, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function seal(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await payloadKey(),
    new TextEncoder().encode(value),
  );
  return `${Buffer.from(iv).toString("base64")}.${Buffer.from(bytes).toString("base64")}`;
}
async function open(value: string) {
  const [iv, data] = value.split(".");
  return new TextDecoder().decode(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: Buffer.from(iv!, "base64") },
      await payloadKey(),
      Buffer.from(data!, "base64"),
    ),
  );
}

export async function sendQuotation(id: string, actor: Actor, renew = false) {
  if (!["rep", "manager", "finance", "admin"].includes(actor.role))
    throw new DomainError("Your role cannot send quotations", 403);
  const intent = await db.transaction(async (tx) => {
    const [quote] = await tx.select().from(quotes).where(eq(quotes.id, id)).for("update");
    if (quote && actor.role === "rep" && quote.ownerId !== actor.id)
      throw new DomainError("Quotation not found", 404);
    if (
      !quote ||
      quote.approvedRevision !== quote.revision ||
      !["APPROVED", "SENT", "UNDER_NEGOTIATION"].includes(quote.status)
    )
      throw new DomainError("Approve current terms before sending", 409);
    const [customer] = await tx.select().from(customers).where(eq(customers.id, quote.customerId));
    const [existing] = await tx
      .select()
      .from(deliveries)
      .where(and(eq(deliveries.quoteId, id), eq(deliveries.revision, quote.revision)))
      .orderBy(desc(deliveries.createdAt), desc(deliveries.id))
      .limit(1);
    if (existing && (!renew || existing.status !== "SENT"))
      return { customer: customer!, delivery: existing, quote };
    if (existing && Date.now() - existing.createdAt.getTime() < 60_000)
      throw new DomainError(
        "An email was just sent. Wait one minute before issuing a replacement link.",
        429,
      );
    if (renew)
      await tx.update(quoteAccess).set({ revoked: true }).where(eq(quoteAccess.quoteId, id));
    const token = crypto.randomUUID() + crypto.randomUUID();
    const url = `${new URL(Bun.env.BETTER_AUTH_URL!).origin}/portal/access?token=${encodeURIComponent(token)}`;
    await tx.insert(quoteAccess).values({
      id: crypto.randomUUID(),
      quoteId: id,
      digest: await tokenDigest(token),
      expiresAt: new Date(Date.now() + 24 * 3600000),
    });
    const [delivery] = await tx
      .insert(deliveries)
      .values({
        id: crypto.randomUUID(),
        quoteId: id,
        revision: quote.revision,
        encryptedPayload: await seal(url),
      })
      .returning();
    await audit(tx, actor, id, "EMAIL_QUEUED", "Quotation access email queued");
    return { customer: customer!, delivery: delivery!, quote };
  });
  if (intent.delivery.status === "SENT") return { status: "SENT", deliveryId: intent.delivery.id };
  const portalUrl = await open(intent.delivery.encryptedPayload);
  let error: string | null = null,
    providerId: string | null = null;
  if (
    Bun.env.EMAIL_TRANSPORT === "test" &&
    new URL(Bun.env.DATABASE_URL!).pathname.endsWith("_test")
  )
    providerId = `test-${intent.delivery.id}`;
  else if (!Bun.env.RESEND_API_KEY)
    error = "Resend is not configured. Configure RESEND_API_KEY and retry.";
  else {
    const override = Bun.env.EMAIL_TEST_RECIPIENT;
    if (
      override &&
      !/^(delivered|bounced|complained|suppressed)(\+[a-zA-Z0-9_-]+)?@resend\.dev$/.test(override)
    )
      throw new DomainError("EMAIL_TEST_RECIPIENT must be a supported Resend test sink", 503);
    const recipient = override || intent.customer.email;
    try {
      const origin = new URL(Bun.env.BETTER_AUTH_URL!).origin;
      const result = await new Resend(Bun.env.RESEND_API_KEY).emails.send(
        {
          from: Bun.env.EMAIL_FROM ?? "DealFlow360 <onboarding@resend.dev>",
          html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f8fafc;margin:0;padding:24px;color:#0f172a;}.card{max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;}.header{padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;text-align:center;}.logo{height:40px;width:auto;max-width:180px;}.content{padding:32px;}.title{font-size:20px;font-weight:700;margin:0 0 12px;color:#0f172a;}.text{font-size:15px;line-height:24px;color:#475569;margin:0 0 20px;}.btn{display:inline-block;background-color:#0284c7;color:#ffffff;font-weight:600;font-size:15px;padding:12px 28px;border-radius:8px;text-decoration:none;text-align:center;}.footer{padding:20px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;font-size:12px;color:#94a3b8;text-align:center;}</style></head><body><div class="card"><div class="header"><img src="${origin}/logo.png" alt="DealFlow360" class="logo" /></div><div class="content"><h1 class="title">Quotation ${intent.quote.number}</h1><p class="text">Hello ${intent.customer.name},</p><p class="text">Your quotation is ready for review. Open your private customer portal to ask questions, propose adjustments, or accept the approved terms:</p><div style="text-align:center;margin:28px 0;"><a href="${portalUrl}" class="btn" style="color:#ffffff;">Open Quotation</a></div><p class="text" style="font-size:13px;color:#64748b;">This secure access link expires in 24 hours.<br/><a href="${portalUrl}" style="color:#0284c7;word-break:break-all;">${portalUrl}</a></p></div><div class="footer">DealFlow360 · Sales Flow. Smarter.</div></div></body></html>`,
          subject: `${intent.quote.number} — your quotation is ready`,
          text: `Hello ${intent.customer.name},\n\nYour quotation is ready for review. Open your private quotation to ask questions, propose changes, or accept the approved terms:\n${portalUrl}\n\nThis access link expires in 24 hours.\nDealFlow360`,
          to: recipient,
        },
        { idempotencyKey: `quotation-${intent.delivery.id}` },
      );
      if (result.error)
        error =
          "Email provider rejected the send. Check the configured sender and recipient, then retry.";
      else if (result.data?.id) providerId = result.data.id;
      else error = "Email provider did not confirm acceptance. Retry this delivery.";
    } catch {
      error = "Email provider is unavailable. Retry this delivery.";
    }
  }
  const outcome = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(deliveries)
      .set({
        status: error
          ? sql`case when ${deliveries.status} = 'SENT' then 'SENT' else 'FAILED' end`
          : "SENT",
        error: error
          ? sql`case when ${deliveries.status} = 'SENT' then null else ${error} end`
          : null,
        providerId: providerId ?? sql`${deliveries.providerId}`,
        attempts: sql`${deliveries.attempts} + 1`,
      })
      .where(eq(deliveries.id, intent.delivery.id))
      .returning();
    if (!error)
      await tx
        .update(quotes)
        .set({ status: "SENT" })
        .where(
          and(
            eq(quotes.id, id),
            eq(quotes.revision, intent.quote.revision),
            eq(quotes.status, "APPROVED"),
          ),
        );
    await audit(
      tx,
      actor,
      id,
      error ? "EMAIL_ATTEMPT_FAILED" : "EMAIL_SENT",
      error ?? "Quotation email accepted by provider",
    );
    return updated!;
  });
  return { status: outcome.status, message: outcome.error, deliveryId: intent.delivery.id };
}
