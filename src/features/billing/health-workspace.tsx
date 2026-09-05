"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { NumberInput } from "@/components/ui/number-input";
import { dealHealth } from "@/features/billing/health";
import { useBillingAction } from "@/features/billing/use-billing-action";
import { PageHeader } from "@/features/shell/page-header";
import { useWorkspace } from "@/features/shell/use-workspace";
import { WorkspaceState } from "@/features/shell/workspace-state";
import { apiClient, apiData } from "@/lib/api/client";

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
    <>
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
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Needs attention", value: visible.length },
          { label: "High priority", value: visible.filter((item) => item.level === "HIGH").length },
          { label: "Dismissed this view", value: dismissed.length },
        ].map((metric) => (
          <Card key={metric.label}>
            <CardHeader>
              <CardDescription>{metric.label}</CardDescription>
              <CardTitle className="text-2xl">{metric.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      {action.error && (
        <Alert variant="destructive">
          <AlertDescription>{action.error}</AlertDescription>
        </Alert>
      )}
      {action.message && (
        <Alert>
          <AlertDescription>{action.message}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {visible.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardDescription>{item.customer}</CardDescription>
                <Badge variant={item.level === "HIGH" ? "destructive" : "secondary"}>
                  {item.level}
                </Badge>
              </div>
              <CardTitle>{item.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{item.detail}</p>
              <div className="flex flex-wrap gap-2">
                <Button nativeButton={false} render={<Link href={item.href} />}>
                  {item.action}
                  <ArrowUpRightIcon />
                </Button>
                {item.quoteId &&
                  ["admin", "manager", "finance", "rep"].includes(data.actor.role) && (
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
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {!visible.length && (
        <Alert>
          <AlertTitle>No open attention signals</AlertTitle>
          <AlertDescription>
            Your visible deals meet the current thresholds. Refresh signals to check again.
          </AlertDescription>
        </Alert>
      )}
      {["admin", "manager"].includes(data.actor.role) && (
        <Card>
          <CardHeader>
            <CardTitle>Attention rules</CardTitle>
            <CardDescription>
              Days since a quote update, invoice due date or pending approval update. Changes apply
              to the entire local workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              method="post"
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (valid)
                  void action.run(
                    async () => apiData(await apiClient.api.v1.health.rules.post(values)),
                    "Health thresholds saved.",
                  );
              }}
            >
              <div className="grid gap-4 sm:grid-cols-3">
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
                <Alert variant="destructive">
                  <AlertDescription>
                    Enter whole numbers within the displayed field limits. Discount difference uses
                    basis points (100 = 1%).
                  </AlertDescription>
                </Alert>
              )}
              <Button type="submit" disabled={!valid || action.pending}>
                Save attention rules
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
      {data.activity
        .filter((entry) => entry.action === "HEALTH_NUDGE")
        .slice(0, 10)
        .map((entry) => (
          <Alert key={entry.id}>
            <AlertTitle>Follow-up recorded · {entry.actorName}</AlertTitle>
            <AlertDescription>{entry.reason}</AlertDescription>
          </Alert>
        ))}
    </>
  );
}
