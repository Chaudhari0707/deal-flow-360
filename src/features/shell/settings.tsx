"use client";

import { type FormEvent, useState } from "react";

import { eyebrowType } from "@/components/editorial/editorial";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NumberInput } from "@/components/ui/number-input";
import { StockSetup } from "@/features/inventory/stock-setup";
import { displayStatus } from "@/features/shell/format";
import { PageHeader } from "@/features/shell/page-header";
import { useWorkspace } from "@/features/shell/use-workspace";
import { WorkspaceState } from "@/features/shell/workspace-state";
import { apiClient, apiData, HttpResponseError } from "@/lib/api/client";
import type { Workspace } from "@/lib/domain/_types/workspace";
import { cn } from "@/lib/utils";

/**
 * Policies are ruled setting rows, not cards: a numbered section rule carries the rhythm, the
 * label sits quietly on the left, and the value is a right-aligned tabular figure on its own
 * hairline. Quiet ink comes from `--muted-foreground`, never from an opacity ladder.
 */
const valueInput =
  "h-8 w-24 shrink-0 rounded-none border-0 border-b-2 border-border-strong bg-transparent px-0 text-right text-sm focus-visible:border-ink-accent dark:bg-transparent";

function policyCopy(id: string) {
  if (id === "pricelists")
    return "Hardware price factors: 9,000 basis points means 90% of the catalog price. New and edited drafts use these prices.";
  if (id === "approvalChain")
    return "Approval ranks determine order: 1 is first. Use 0 to disable a role. HIGH-risk quotes use every enabled step; lower-risk quotes use the first.";
  if (id === "health")
    return "Day thresholds control follow-ups; the anomaly threshold uses basis points (100 = 1%).";
  return "Percentage policies use basis points: 100 basis points = 1%.";
}

function fieldMin(settingId: string, key: string) {
  if (settingId === "approvalChain") return 0;
  return (settingId === "health" && key !== "anomalyBps") || key.startsWith("high") ? 1 : 0;
}

function fieldMax(settingId: string, key: string) {
  if (settingId === "approvalChain") return 10;
  if (settingId !== "health") return 10000;
  if (key === "historyDays") return 365;
  if (key === "staleDays") return 90;
  return key === "approvalDays" || key === "overdueDays" ? 60 : 10000;
}

function PolicyForm({
  index,
  setting,
  saved,
}: {
  index: string;
  setting: Workspace["settings"][number];
  saved: () => Promise<unknown>;
}) {
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = Object.fromEntries(
      Object.keys(setting.value).map((key) => [key, Number(form.get(key))]),
    );
    setPending(true);
    setError("");
    setNotice("");
    try {
      apiData(await apiClient.api.v1.settings({ id: setting.id }).patch({ value }));
      await saved();
      setNotice("Policy saved. New submissions will use the updated values.");
    } catch (failure) {
      setError(
        failure instanceof HttpResponseError && failure.status === 403
          ? "Only authorized managers can change policy."
          : "Could not save this policy. Check the values and try again.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section>
      <h2 className="flex items-baseline gap-3 border-b border-border-strong pb-3">
        <span className="text-sm font-medium text-foreground tabular-nums">{index}</span>
        <span aria-hidden className="h-px w-6 self-center bg-border-strong" />
        <span className={cn(eyebrowType, "text-muted-foreground")}>
          {displayStatus(setting.id)}
        </span>
      </h2>
      <p className="mt-4 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
        {policyCopy(setting.id)}
      </p>
      <form method="post" onSubmit={submit} className="mt-6">
        <FieldGroup className="gap-0">
          {Object.entries(setting.value).map(([key, value]) => (
            <Field
              key={key}
              orientation="horizontal"
              className="items-center gap-6 border-b border-border py-2.5"
            >
              <FieldLabel
                htmlFor={`${setting.id}-${key}`}
                className="text-sm font-normal text-foreground"
              >
                {displayStatus(key)}
              </FieldLabel>
              <NumberInput
                id={`${setting.id}-${key}`}
                name={key}
                required
                min={fieldMin(setting.id, key)}
                step="1"
                max={fieldMax(setting.id, key)}
                defaultValue={value}
                className={valueInput}
              />
            </Field>
          ))}
        </FieldGroup>
        {error && (
          <Alert variant="destructive" className="mt-5">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {notice && (
          <Alert role="status" className="mt-5">
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" disabled={pending} className="mt-6">
          {pending ? "Saving…" : "Save policy"}
        </Button>
      </form>
    </section>
  );
}

export function Settings() {
  const { data, error, mutate } = useWorkspace();
  if (error || !data)
    return (
      <WorkspaceState
        error={error}
        retry={() => {
          void mutate();
        }}
      />
    );
  if (!["admin", "manager"].includes(data.actor.role))
    return <WorkspaceState error={new HttpResponseError(403, "Forbidden")} />;
  return (
    <>
      <PageHeader
        title="Workspace settings"
        description="Keep pricing guardrails and operational policies clear and consistent."
        actions={
          <span className={cn(eyebrowType, "flex items-center gap-2 text-muted-foreground")}>
            <span aria-hidden className="size-1.5 bg-ink-accent" />
            Manager access
          </span>
        }
      />
      <div className="grid items-start gap-x-16 gap-y-12 xl:grid-cols-2">
        {data.settings.map((setting, position) => (
          <PolicyForm
            key={setting.id}
            index={String(position + 1).padStart(2, "0")}
            setting={setting}
            saved={mutate}
          />
        ))}
      </div>
      {data.actor.role === "admin" && (
        <section className="mt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3 border-b border-border-strong pb-3">
            <h2 className={cn(eyebrowType, "text-foreground")}>Stock locations</h2>
            <StockSetup
              workspace={data}
              refresh={() => {
                void mutate();
              }}
            />
          </div>
          <p className="mt-4 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
            Enable a stockable product at a warehouse before Operations records its first delivery.
            Configuring a location creates a zero balance; it never changes stock that is already on
            hand.
          </p>
        </section>
      )}
      {!data.settings.length && (
        <Alert>
          <AlertDescription>
            No policies are configured. Run the local demo seed to load the agreed policy defaults.
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
