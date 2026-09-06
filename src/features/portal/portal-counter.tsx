"use client";

import { type FormEvent, useState } from "react";

import { eyebrowType } from "@/components/editorial/editorial";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import type { PortalDetail } from "@/features/portal/_types/portal";
import { apiClient, apiData, HttpResponseError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

/** Quiet label type: hierarchy from size, weight, case and letter-spacing, never from opacity. */

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
      apiData(
        await apiClient.api.v1.portal({ id: data.quote.id }).counter.post({
          revision: data.quote.revision,
          lines,
          ...(promisedDate ? { promisedDate } : {}),
        }),
      );
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
    <section>
      <div className="border-b border-border-strong pb-3">
        <h2 className={cn(eyebrowType, "text-foreground")}>Request a change</h2>
      </div>
      <p className="mt-5 max-w-[52ch] text-sm leading-relaxed text-muted-foreground">
        Propose a line discount or delivery date. Your account manager will review the updated
        quotation.
      </p>
      <form method="post" onSubmit={submit} className="mt-7">
        <FieldGroup>
          {data.quote.lines.map((line) => (
            <Field key={line.id}>
              <FieldLabel htmlFor={`discount-${line.id}`}>{line.name} · discount (%)</FieldLabel>
              <NumberInput
                id={`discount-${line.id}`}
                name={line.id}
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
          <Button type="submit" variant="outline" className="self-start" disabled={pending}>
            {pending ? "Sending request…" : "Request changes"}
          </Button>
        </FieldGroup>
      </form>
    </section>
  );
}
