"use client";

import { type FormEvent, useState } from "react";

import { eyebrowType } from "@/components/editorial/editorial";
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
import type { PortalDetail } from "@/features/portal/_types/portal";
import { displayDate } from "@/features/shell/format";
import { apiClient, apiData } from "@/lib/api/client";
import { cn } from "@/lib/utils";

/** Quiet label type: hierarchy from size, weight, case and letter-spacing, never from opacity. */

export function PortalConversation({
  data,
  saved,
}: {
  data: PortalDetail;
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
        await apiClient.api.v1.portal({ id: data.quote.id }).message.post({
          body: body.trim(),
          ...(lineId !== "all" ? { lineId } : {}),
        }),
      );
      setBody("");
      await saved();
    } catch {
      setError("Your message wasn't sent. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section>
      <div className="border-b border-border-strong pb-3">
        <h2 className={cn(eyebrowType, "text-foreground")}>Let's talk about your quote</h2>
      </div>
      <p className="mt-5 max-w-[52ch] text-sm leading-relaxed text-muted-foreground">
        Keep every question and answer in one place.
      </p>
      <div className="mt-7 max-h-96 overflow-y-auto" aria-live="polite">
        {data.messages.map((message) => (
          <div key={message.id} className="border-b border-border py-5 first:pt-0 last:border-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
              <p className="text-sm font-medium text-foreground">{message.authorName}</p>
              <time className="text-xs text-muted-foreground tabular-nums">
                {displayDate(message.createdAt)}
              </time>
            </div>
            {message.lineId && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {data.quote.lines.find((line) => line.id === message.lineId)?.name ?? "Line item"}
              </p>
            )}
            <p className="mt-2.5 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
              {message.body}
            </p>
          </div>
        ))}
        {!data.messages.length && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Have a question about pricing or delivery? Start the conversation below.
          </p>
        )}
      </div>
      {data.actor.role === "customer" && (
        <form method="post" onSubmit={submit} className="mt-8 border-t border-border pt-7">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="message-line">About</FieldLabel>
              <Select value={lineId} onValueChange={(value) => setLineId(value ?? "all")}>
                <SelectTrigger id="message-line" className="w-full">
                  <SelectValue>
                    {lineId === "all"
                      ? "Entire quotation"
                      : data.quote.lines.find((line) => line.id === lineId)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Entire quotation</SelectItem>
                  {data.quote.lines.map((line) => (
                    <SelectItem key={line.id} value={line.id}>
                      {line.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="message-body">Your message</FieldLabel>
              <Textarea
                id="message-body"
                required
                minLength={1}
                maxLength={2000}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Ask a question or share what you need…"
                rows={3}
              />
            </Field>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="self-start" disabled={pending || !body.trim()}>
              {pending ? "Sending…" : "Send message"}
            </Button>
          </FieldGroup>
        </form>
      )}
    </section>
  );
}
