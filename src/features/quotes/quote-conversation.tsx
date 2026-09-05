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
import { displayDate } from "@/features/shell/format";
import { apiClient, apiData } from "@/lib/api/client";

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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Customer conversation</CardTitle>
        <CardDescription>
          Answer line questions here. Staff never use the customer portal to reply.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="max-h-80 space-y-4 overflow-y-auto" aria-live="polite">
          {messages.map((message) => (
            <div key={message.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{message.authorName}</p>
                <time className="text-xs text-muted-foreground">
                  {displayDate(message.createdAt)}
                </time>
              </div>
              {message.lineId && (
                <Badge variant="outline">
                  {lines.find((line) => line.id === message.lineId)?.name ?? "Line item"}
                </Badge>
              )}
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{message.body}</p>
              <Separator className="mt-4" />
            </div>
          ))}
          {!messages.length && (
            <p className="py-4 text-sm text-muted-foreground">No customer messages yet.</p>
          )}
        </div>
        {canReply && (
          <form method="post" onSubmit={submit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="quote-message-line">About</FieldLabel>
                <Select value={lineId} onValueChange={(value) => setLineId(value ?? "all")}>
                  <SelectTrigger id="quote-message-line" className="w-full">
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
                <FieldLabel htmlFor="quote-message-body">Your reply</FieldLabel>
                <Textarea
                  id="quote-message-body"
                  required
                  minLength={1}
                  maxLength={2000}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Answer the customer without leaving the workspace…"
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
                {pending ? "Sending…" : "Send reply"}
              </Button>
            </FieldGroup>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
