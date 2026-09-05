import { eq } from "drizzle-orm";

import { db } from "@/lib/db/connection";
import { messages, quotes } from "@/lib/db/schema";
import type { Actor } from "@/lib/domain/_types/domain";
import { DomainError } from "@/server/errors";

export async function postQuoteMessage(
  id: string,
  input: { body: string; lineId?: string },
  actor: Actor,
) {
  if (actor.role !== "rep" && actor.role !== "manager" && actor.role !== "finance")
    throw new DomainError("Your role cannot perform this action.", 403);
  const body = input.body.trim();
  if (!body) throw new DomainError("Write a message before sending");
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, id));
  if (!quote || (actor.role === "rep" && quote.ownerId !== actor.id))
    throw new DomainError("Quotation not found", 404);
  if (input.lineId && !quote.lines.some((line) => line.id === input.lineId))
    throw new DomainError("Unknown line");
  const [message] = await db
    .insert(messages)
    .values({
      id: crypto.randomUUID(),
      quoteId: id,
      lineId: input.lineId,
      authorId: actor.id,
      authorName: actor.name,
      body,
    })
    .returning();
  return message!;
}
