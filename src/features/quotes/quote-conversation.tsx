"use client";

import { type FormEvent, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { eyebrowType, RailHead, ruledControl } from "@/features/quotes/quote-editorial";
import { displayDate } from "@/features/shell/format";
import { apiClient, apiData } from "@/lib/api/client";
import { cn } from "@/lib/utils";

interface ConversationLine {
  id: string;
  name: string;
}

interface ConversationMessage {
  authorName: string;
  body: string;
  createdAt: string;
  id: string;
  lineId: string | null;
}

const labelType = cn(eyebrowType, "text-muted-foreground");

/**
 * The customer thread as a ruled timeline: one hairline-separated entry per message, the author
 * and date set as quiet meta above the reply itself, and the line a message is about carried as a
 * letterspaced label rather than a pill.
 */
export function QuoteConversation({
  canReply,
  messages,
  quoteId,
  lines,
  saved,
}: {
  canReply: boolean;
  lines: ConversationLine[];
  messages: ConversationMessage[];
  quoteId: string;
  saved: () => Promise<unknown>;
}) {
  const [body, setBody] = useState("");
  const [lineId, setLineId] = useState("all");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      apiData(
        await apiClient.api.v1.quotes({ id: quoteId }).message.post({
          body: body.trim(),
          ...(lineId !== "all" ? { lineId } : {}),
        }),
      );
      setBody("");
      await saved();
    } catch {
      setError("Your reply wasn't sent. Refresh and try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section>
      <RailHead title="Customer conversation">
        Answer line questions here. Staff never use the customer portal to reply.
      </RailHead>
      <div className="max-h-80 overflow-y-auto" aria-live="polite">
        {messages.map((message) => (
          <article key={message.id} className="border-b border-border py-4 last:border-b-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-sm font-medium text-foreground">{message.authorName}</p>
              <time className="text-xs text-muted-foreground tabular-nums">
                {displayDate(message.createdAt)}
              </time>
            </div>
            {message.lineId && (
              <p className={cn(labelType, "mt-2")}>
                {lines.find((line) => line.id === message.lineId)?.name ?? "Line item"}
              </p>
            )}
            <p className="mt-2 text-sm whitespace-pre-wrap text-foreground">{message.body}</p>
          </article>
        ))}
        {!messages.length && (
          <p className="py-4 text-sm text-muted-foreground">No customer messages yet.</p>
        )}
      </div>
      {canReply && (
        <form method="post" onSubmit={submit} className="mt-6 border-t border-border pt-6">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="quote-message-line" className={labelType}>
                About
              </FieldLabel>
              <Select value={lineId} onValueChange={(value) => setLineId(value ?? "all")}>
                <SelectTrigger id="quote-message-line" className={cn(ruledControl, "w-full")}>
                  <SelectValue>
                    {lineId === "all"
                      ? "Entire quotation"
                      : lines.find((line) => line.id === lineId)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Entire quotation</SelectItem>
                  {lines.map((line) => (
                    <SelectItem key={line.id} value={line.id}>
                      {line.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="quote-message-body" className={labelType}>
                Your reply
              </FieldLabel>
              <Textarea
                id="quote-message-body"
                required
                minLength={1}
                maxLength={2000}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Answer the customer without leaving the workspace…"
                rows={3}
                className={ruledControl}
              />
            </Field>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="self-start" disabled={pending || !body.trim()}>
              {pending ? "Sending…" : "Send reply"}
            </Button>
          </FieldGroup>
        </form>
      )}
    </section>
  );
}
