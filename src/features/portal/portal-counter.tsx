"use client";

import { type FormEvent, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { PortalDetail } from "@/features/portal/_types/portal";
import { fetchJson, HttpResponseError } from "@/lib/swr/fetcher";

export function PortalCounter({
  data,
  saved,
}: {
  data: PortalDetail;
  saved: () => Promise<unknown>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const lines = data.quote.lines.map((line) => ({
      id: line.id,
      discountBps: Math.round(Number(form.get(line.id)) * 100),
    }));
    const promisedDate = String(form.get("promisedDate") ?? "");
    setPending(true);
    setError("");
    setNotice("");
    try {
      await fetchJson(`/api/v1/portal/${data.quote.id}/counter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision: data.quote.revision,
          lines,
          ...(promisedDate ? { promisedDate } : {}),
        }),
      });
      await saved();
      setNotice("Your requested changes were sent for review. We'll keep the conversation here.");
    } catch (failure) {
      setError(
        failure instanceof HttpResponseError && failure.status === 409
          ? "This quotation changed. Refresh the page and review the latest version before requesting changes."
          : "Unable to send your changes. Check the values and try again.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Request a change</CardTitle>
        <CardDescription>
          Propose a line discount or delivery date. Your account manager will review the updated
          quotation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form method="post" onSubmit={submit}>
          <FieldGroup>
            {data.quote.lines.map((line) => (
              <Field key={line.id}>
                <FieldLabel htmlFor={`discount-${line.id}`}>{line.name} · discount (%)</FieldLabel>
                <Input
                  id={`discount-${line.id}`}
                  name={line.id}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  required
                  defaultValue={line.discountBps / 100}
                />
              </Field>
            ))}
            <Field>
              <FieldLabel htmlFor="counter-date">Requested delivery date</FieldLabel>
              <Input
                id="counter-date"
                name="promisedDate"
                type="date"
                defaultValue={data.quote.promisedDate ?? ""}
              />
            </Field>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {notice && (
              <Alert role="status">
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? "Sending request…" : "Request changes"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
