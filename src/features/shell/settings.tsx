"use client";

import { type FormEvent, useState } from "react";
import { Save, ShieldCheck } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { displayStatus } from "@/features/shell/format";
import { PageHeader } from "@/features/shell/page-header";
import { useWorkspace } from "@/features/shell/use-workspace";
import { WorkspaceState } from "@/features/shell/workspace-state";
import type { Workspace } from "@/lib/domain/_types/workspace";
import { fetchJson, HttpResponseError } from "@/lib/swr/fetcher";

function PolicyForm({
  setting,
  saved,
}: {
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
      await fetchJson(`/api/v1/settings/${setting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
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
    <Card>
      <CardHeader>
        <CardTitle>{displayStatus(setting.id)}</CardTitle>
        <CardDescription>
          {setting.id === "pricelists"
            ? "Hardware price factors: 9,000 basis points means 90% of the catalog price. New and edited drafts use these prices."
            : setting.id === "health"
              ? "Day thresholds control follow-ups; the anomaly threshold uses basis points (100 = 1%)."
              : "Percentage policies use basis points: 100 basis points = 1%."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form method="post" onSubmit={submit}>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              {Object.entries(setting.value).map(([key, value]) => (
                <Field key={key}>
                  <FieldLabel htmlFor={`${setting.id}-${key}`}>{displayStatus(key)}</FieldLabel>
                  <Input
                    id={`${setting.id}-${key}`}
                    name={key}
                    type="number"
                    required
                    min={
                      (setting.id === "health" && key !== "anomalyBps") || key.startsWith("high")
                        ? 1
                        : 0
                    }
                    step="1"
                    max={
                      setting.id === "health"
                        ? key === "historyDays"
                          ? 365
                          : key === "staleDays"
                            ? 90
                            : key === "approvalDays" || key === "overdueDays"
                              ? 60
                              : 10000
                        : 10000
                    }
                    defaultValue={value}
                  />
                </Field>
              ))}
            </div>
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
            <Button type="submit" disabled={pending} className="self-start">
              <Save />
              {pending ? "Saving…" : "Save policy"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
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
          <Badge variant="outline">
            <ShieldCheck />
            Manager access
          </Badge>
        }
      />
      <div className="grid items-start gap-6 xl:grid-cols-2">
        {data.settings.map((setting) => (
          <PolicyForm key={setting.id} setting={setting} saved={mutate} />
        ))}
      </div>
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
