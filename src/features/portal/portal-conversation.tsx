"use client";

import { type FormEvent, useState } from "react";
import { Send } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { PortalDetail } from "@/features/portal/_types/portal";
import { displayDate } from "@/features/shell/format";
import { fetchJson } from "@/lib/swr/fetcher";

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
      await fetchJson(`/api/v1/portal/${data.quote.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim(), ...(lineId !== "all" ? { lineId } : {}) }),
      });
      setBody("");
      await saved();
    } catch {
      setError("Your message wasn't sent. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Let's talk about your quote</CardTitle>
        <CardDescription>Keep every question and answer in one place.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="max-h-80 space-y-4 overflow-y-auto" aria-live="polite">
          {data.messages.map((message) => (
            <div key={message.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{message.authorName}</p>
                <time className="text-xs text-muted-foreground">
                  {displayDate(message.createdAt)}
                </time>
              </div>
              {message.lineId && (
                <Badge variant="outline">
                  {data.quote.lines.find((line) => line.id === message.lineId)?.name ?? "Line item"}
                </Badge>
              )}
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{message.body}</p>
              <Separator className="mt-4" />
            </div>
          ))}
          {!data.messages.length && (
            <p className="py-4 text-sm text-muted-foreground">
              Have a question about pricing or delivery? Start the conversation below.
            </p>
          )}
        </div>
        {["customer", "rep", "manager", "admin"].includes(data.actor.role) && (
          <form method="post" onSubmit={submit}>
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
                <Send />
                {pending ? "Sending…" : "Send message"}
              </Button>
            </FieldGroup>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
