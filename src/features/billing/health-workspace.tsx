"use client";
import { type ReactNode, useState } from "react";
import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { NumberInput } from "@/components/ui/number-input";
import { dealHealth } from "@/features/billing/health";
import { eyebrowType } from "@/features/billing/invoice-editorial";
import { useBillingAction } from "@/features/billing/use-billing-action";
import { PageHeader } from "@/features/shell/page-header";
import { useWorkspace } from "@/features/shell/use-workspace";
import { WorkspaceState } from "@/features/shell/workspace-state";
import { apiClient, apiData } from "@/lib/api/client";
import { cn } from "@/lib/utils";

/** Section rule, matched to the shared table masthead: quiet kicker, one firm rule, tally. */
function SectionHead({ note, title }: { note?: string; title: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-b border-border-strong pb-3">
      <h2 className={cn(eyebrowType, "text-foreground")}>{title}</h2>
      {note ? <p className="text-xs text-muted-foreground tabular-nums">{note}</p> : null}
    </div>
  );
}

/**
 * A count in the signal band. Risk ink is reserved for the one figure that names a real state:
 * outstanding high-priority work. At zero it drops back to the neutral ink, so the colour keeps
 * meaning something rather than decorating a heading.
 */
function Figure({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: "neutral" | "risk";
  value: number;
}) {
  return (
    <div className="py-7 sm:px-8 sm:first:pl-0 sm:last:pr-0">
      <dt className={cn(eyebrowType, "text-muted-foreground")}>{label}</dt>
      <dd
        className={cn(
          "mt-3 text-[1.75rem] leading-none font-medium tracking-tight tabular-nums",
          tone === "risk" ? "text-ink-risk" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function SignalRow({
  actions,
  customer,
  detail,
  level,
  title,
}: {
  actions: ReactNode;
  customer: string;
  detail: string;
  level: "HIGH" | "MEDIUM";
  title: string;
}) {
  return (
    <li className="grid gap-x-10 gap-y-4 border-b border-border py-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Badge variant={level === "HIGH" ? "destructive" : "secondary"}>{level}</Badge>
          <span className="text-xs text-muted-foreground">{customer}</span>
        </div>
        <h3 className="mt-2.5 text-base leading-snug font-medium text-foreground">{title}</h3>
        <p className="mt-1.5 max-w-[76ch] text-sm leading-relaxed text-muted-foreground">
          {detail}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3 lg:justify-end">{actions}</div>
    </li>
  );
}

export function HealthWorkspace() {
  const { data, error, mutate } = useWorkspace();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [draft, setDraft] = useState<{
    anomalyBps: number;
    approvalDays: number;
    historyDays: number;
    overdueDays: number;
    staleDays: number;
  } | null>(null);
  const action = useBillingAction();
  if (!data) return <WorkspaceState error={error} retry={() => void mutate()} />;
  const { items, rules } = dealHealth(data);
  const values = draft ?? rules;
  const visible = items.filter((item) => !dismissed.includes(item.id));
  const highPriority = visible.filter((item) => item.level === "HIGH").length;
  const followUps = data.activity.filter((entry) => entry.action === "HEALTH_NUDGE").slice(0, 10);
  const valid =
    Object.values(values).every(Number.isInteger) &&
    values.anomalyBps >= 0 &&
    values.anomalyBps <= 10000 &&
    values.historyDays >= 1 &&
    values.historyDays <= 365 &&
    values.approvalDays >= 1 &&
    values.approvalDays <= 60 &&
    values.overdueDays >= 1 &&
    values.overdueDays <= 60 &&
    values.staleDays >= 1 &&
    values.staleDays <= 90;
  return (
    <div className="mx-auto w-full max-w-300 pb-6">
      <PageHeader
        title="Deal health"
        description="Turn stalled approvals, overdue balances and delivery risks into a clear next action."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              setDismissed([]);
              void mutate();
            }}
          >
            Refresh signals
          </Button>
        }
      />
      <section className="mt-10">
        <h2 className="sr-only">Signal summary</h2>
        <dl className="grid grid-cols-2 gap-x-10 border-t border-border sm:grid-cols-3 sm:gap-x-0 sm:divide-x sm:divide-border">
          <Figure label="Needs attention" value={visible.length} />
          <Figure
            label="High priority"
            tone={highPriority > 0 ? "risk" : "neutral"}
            value={highPriority}
          />
          <Figure label="Dismissed this view" value={dismissed.length} />
        </dl>
      </section>
      {action.error && (
        <Alert variant="destructive" className="mt-8">
          <AlertDescription>{action.error}</AlertDescription>
        </Alert>
      )}
      {action.message && (
        <Alert className="mt-8">
          <AlertDescription>{action.message}</AlertDescription>
        </Alert>
      )}
      <section className="mt-12">
        <SectionHead title="Attention signals" note={`${visible.length} of ${items.length}`} />
        <ul>
          {visible.map((item) => (
            <SignalRow
              key={item.id}
              customer={item.customer}
              detail={item.detail}
              level={item.level}
              title={item.title}
              actions={
                <>
                  <Button nativeButton={false} render={<Link href={item.href} />}>
                    {item.action}
                    <ArrowUpRightIcon />
                  </Button>
                  {item.quoteId && data.actor.role === "manager" && (
                    <Button
                      variant="outline"
                      disabled={action.pending}
                      onClick={() =>
                        void action.run(
                          async () =>
                            apiData(
                              await apiClient.api.v1.health.nudge.post({
                                operationKey: crypto.randomUUID(),
                                quoteId: item.quoteId!,
                                reason: `Follow up: ${item.title}`,
                              }),
                            ),
                          "Follow-up recorded for the deal owner in the activity feed.",
                        )
                      }
                    >
                      Record nudge
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => setDismissed([...dismissed, item.id])}>
                    Dismiss
                  </Button>
                </>
              }
            />
          ))}
        </ul>
        {!visible.length && (
          <Alert className="mt-6">
            <AlertTitle>No open attention signals</AlertTitle>
            <AlertDescription>
              Your visible deals meet the current thresholds. Refresh signals to check again.
            </AlertDescription>
          </Alert>
        )}
      </section>
      {["admin", "manager"].includes(data.actor.role) && (
        <section className="mt-12">
          <SectionHead title="Attention rules" />
          <p className="max-w-[84ch] pt-5 text-sm leading-relaxed text-muted-foreground">
            Days since a quote update, invoice due date or pending approval update. Changes apply to
            the entire local workspace.
          </p>
          <form
            method="post"
            className="pt-7"
            onSubmit={(event) => {
              event.preventDefault();
              if (valid)
                void action.run(
                  async () => apiData(await apiClient.api.v1.health.rules.post(values)),
                  "Health thresholds saved.",
                );
            }}
          >
            <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  { key: "staleDays", label: "Stale deal days", min: 1, max: 90 },
                  { key: "overdueDays", label: "Overdue invoice days", min: 1, max: 60 },
                  { key: "approvalDays", label: "Waiting approval days", min: 1, max: 60 },
                  {
                    key: "anomalyBps",
                    label: "Discount anomaly basis points",
                    min: 0,
                    max: 10000,
                  },
                  { key: "historyDays", label: "Discount history days", min: 1, max: 365 },
                ] as const
              ).map((field) => (
                <Field key={field.key}>
                  <FieldLabel htmlFor={field.key}>{field.label}</FieldLabel>
                  <NumberInput
                    id={field.key}
                    min={field.min}
                    max={field.max}
                    step={1}
                    value={values[field.key]}
                    onValueChange={(value) =>
                      setDraft({ ...values, [field.key]: value ?? Number.NaN })
                    }
                  />
                </Field>
              ))}
            </div>
            {!valid && (
              <Alert variant="destructive" className="mt-7">
                <AlertDescription>
                  Check each field: use whole numbers inside the shown limits. Discount difference
                  uses basis points (100 = 1%).
                </AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="mt-8" disabled={!valid || action.pending}>
              Save attention rules
            </Button>
          </form>
        </section>
      )}
      {followUps.length > 0 && (
        <section className="mt-12">
          <SectionHead title="Follow-up log" note={`${followUps.length} recorded`} />
          <div className="space-y-5 pt-6">
            {followUps.map((entry) => (
              <Alert key={entry.id}>
                <AlertTitle>Follow-up recorded · {entry.actorName}</AlertTitle>
                <AlertDescription>{entry.reason}</AlertDescription>
              </Alert>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
