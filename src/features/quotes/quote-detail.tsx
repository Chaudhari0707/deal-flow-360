"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, Mail, Pencil, ShieldCheck, X } from "lucide-react";
import useSWR from "swr";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { quoteRequest } from "@/features/quotes/client-action";
import { QuoteEditor } from "@/features/quotes/quote-editor";
import { money } from "@/features/quotes/rules";
import { PageHeader } from "@/features/shell/page-header";
import { useWorkspace } from "@/features/shell/use-workspace";
import { WorkspaceState } from "@/features/shell/workspace-state";
import type { Workspace } from "@/lib/domain/_types/workspace";

export function QuoteDetail({ isNew = false }: { isNew?: boolean }) {
  const router = useRouter();
  const params = useParams<{ id: string }>(),
    { data, error, mutate } = useWorkspace();
  const detail = useSWR<{ activity: Workspace["activity"]; messages: Workspace["messages"] }>(
    !isNew && params.id ? `/api/v1/quotes/${params.id}` : null,
  );
  const [editing, setEditing] = useState(false),
    [pending, setPending] = useState(false),
    [failure, setFailure] = useState(""),
    [notice, setNotice] = useState(""),
    [reason, setReason] = useState("");
  if (!data) return <WorkspaceState error={error} retry={() => void mutate()} />;
  const quote = isNew ? undefined : data.quotes.find((q) => q.id === params.id);
  if (!isNew && !quote)
    return (
      <Card>
        <CardHeader>
          <CardTitle>Quotation not found</CardTitle>
          <CardDescription>Refresh the workspace or return to your pipeline.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button nativeButton={false} render={<Link href="/quotations" />}>
            Back to quotations
          </Button>
        </CardContent>
      </Card>
    );
  const canEdit = ["rep", "manager", "admin"].includes(data.actor.role);
  const customer = data.customers.find((c) => c.id === quote?.customerId);
  const onSaved = async () => {
    setEditing(false);
    await mutate();
    await detail.mutate();
  };
  async function duplicate() {
    if (!quote) return;
    setPending(true);
    setFailure("");
    try {
      const saved = await quoteRequest<{ id: string }>("/quotes", {
        customerId: quote.customerId,
        lines: quote.lines.map((line) => ({
          id: crypto.randomUUID(),
          productId: line.productId,
          quantity: line.quantity,
          discountBps: line.discountBps,
          upsell: line.upsell,
        })),
        orderDiscountBps: quote.orderDiscountBps,
        notes: quote.notes,
        ...(quote.promisedDate ? { promisedDate: quote.promisedDate } : {}),
      });
      await mutate();
      router.push(`/quotations/${saved.id}`);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Unable to copy quotation");
    } finally {
      setPending(false);
    }
  }
  async function act(action: "approve" | "return" | "reject" | "send" | "submit") {
    if (!quote) return;
    setPending(true);
    setFailure("");
    setNotice("");
    try {
      const result = await quoteRequest<{ status?: string; message?: string }>(
        `/quotes/${quote.id}/${["approve", "return", "reject"].includes(action) ? "approval" : action}`,
        action === "send"
          ? { renew: quote.status === "SENT" || quote.status === "UNDER_NEGOTIATION" }
          : action === "submit"
            ? { revision: quote.revision }
            : { revision: quote.revision, action, reason },
      );
      if (result.status === "FAILED")
        setFailure(result.message ?? "Email delivery failed; retry after checking configuration.");
      else setNotice(action === "send" ? "Email accepted by provider." : "Quotation updated.");
      await onSaved();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Action failed");
    } finally {
      setPending(false);
    }
  }
  const reviewer =
    quote?.status === "PENDING_APPROVAL" &&
    (data.actor.role === quote.approvalStep || data.actor.role === "admin");
  const approved = quote?.approvedRevision === quote?.revision && quote !== undefined;
  return (
    <>
      <div>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/quotations" />}>
          <ArrowLeft />
          All quotations
        </Button>
      </div>
      <PageHeader
        title={isNew ? "New quotation" : quote!.number}
        description={
          isNew
            ? "Build the right offer with pricing you can explain."
            : `${customer?.name ?? "Customer"} · ${customer?.tier ?? ""} tier · Revision ${quote!.revision}`
        }
        actions={
          quote ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{quote.status.replaceAll("_", " ")}</Badge>
              {canEdit && ["CONFIRMED", "REJECTED"].includes(quote.status) && (
                <Button variant="outline" disabled={pending} onClick={() => void duplicate()}>
                  Copy to new draft
                </Button>
              )}
              {canEdit && !["CONFIRMED", "REJECTED"].includes(quote.status) && (
                <Button variant="outline" onClick={() => setEditing((v) => !v)}>
                  <Pencil />
                  {editing ? "View quotation" : "Edit terms"}
                </Button>
              )}
            </div>
          ) : undefined
        }
      />
      {failure && (
        <Alert variant="destructive">
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      {(isNew || editing || quote?.status === "DRAFT" || quote?.status === "RETURNED") &&
      canEdit ? (
        <QuoteEditor
          key={`${quote?.id ?? "new"}:${quote?.revision ?? 0}`}
          data={data}
          quote={quote}
          onSaved={onSaved}
        />
      ) : (
        quote && (
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Quotation summary</CardTitle>
                  <CardDescription>Accepted prices stay attached to this revision.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Discount</TableHead>
                        <TableHead>Billing</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quote.lines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell>
                            <p className="font-medium">{line.name}</p>
                            <p className="text-xs text-muted-foreground">{line.variant}</p>
                          </TableCell>
                          <TableCell>{line.quantity}</TableCell>
                          <TableCell>{line.discountBps / 100}%</TableCell>
                          <TableCell>
                            {line.intervalMonths ? `Every ${line.intervalMonths}mo` : "One-time"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {money(line.totalCents)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Separator className="my-4" />
                  <div className="flex justify-between text-lg font-semibold">
                    <span>One-time total</span>
                    <span>{money(quote.totalCents)}</span>
                  </div>
                  {quote.lines
                    .filter((l) => l.intervalMonths > 0)
                    .map((l) => (
                      <div key={l.id} className="mt-2 flex justify-between text-sm">
                        <span>{l.name}</span>
                        <span>
                          {money(l.totalCents)} / {l.intervalMonths}mo
                        </span>
                      </div>
                    ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Discount review</CardTitle>
                  <CardDescription>
                    The most restrictive customer and category ceiling applies to each line.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {quote.riskSnapshot?.lines.map((line, i) => (
                    <div
                      key={`${line.name}-${i}`}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{line.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {line.effectiveBps / 100}% effective · {line.ceilingBps / 100}% ceiling
                        </p>
                      </div>
                      <Badge variant={line.overBps > 0 ? "destructive" : "secondary"}>
                        {line.overBps > 0
                          ? `+${(line.overBps / 100).toFixed(2)}pt over`
                          : "Within policy"}
                      </Badge>
                    </div>
                  ))}
                  {quote.notes && (
                    <p className="text-sm text-muted-foreground">Justification: {quote.notes}</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Audit trail</CardTitle>
                  <CardDescription>Who acted, when, and why.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {detail.data?.activity.map((event) => (
                    <div key={event.id} className="border-l-2 border-primary/20 pl-4">
                      <div className="flex flex-wrap justify-between gap-1">
                        <p className="text-sm font-medium">{event.action.replaceAll("_", " ")}</p>
                        <span className="text-xs text-muted-foreground">
                          {new Date(event.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {event.actorName} · {event.reason}
                      </p>
                    </div>
                  ))}
                  {!detail.data?.activity.length && (
                    <p className="text-sm text-muted-foreground">
                      Activity appears when the quotation is submitted.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardDescription>Current approval risk</CardDescription>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="text-primary" />
                    {quote.risk}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {approved
                      ? "This revision is approved. Customer confirmation may proceed."
                      : quote.approvalStep
                        ? `Waiting for ${quote.approvalStep === "finance" ? "Finance" : "Sales Manager"}.`
                        : "Approval follows the current commercial revision."}
                  </p>
                  {reviewer && (
                    <>
                      <Field>
                        <FieldLabel htmlFor="approval-reason">Decision reason</FieldLabel>
                        <Input
                          id="approval-reason"
                          placeholder="Explain your decision"
                          maxLength={1000}
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                      </Field>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          disabled={pending || reason.trim().length < 3}
                          onClick={() => void act("approve")}
                        >
                          <Check />
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          disabled={pending || reason.trim().length < 3}
                          onClick={() => void act("return")}
                        >
                          Return
                        </Button>
                        <Button
                          variant="destructive"
                          disabled={pending || reason.trim().length < 3}
                          onClick={() => void act("reject")}
                        >
                          <X />
                          Reject
                        </Button>
                      </div>
                    </>
                  )}
                  {approved && quote.status !== "CONFIRMED" && (
                    <>
                      <Button
                        className="w-full"
                        disabled={pending}
                        onClick={() => void act("send")}
                      >
                        <Mail />
                        Send quotation email
                      </Button>
                    </>
                  )}
                  {quote.status === "CONFIRMED" && (
                    <Button nativeButton={false} render={<Link href="/fulfillment" />}>
                      View fulfillment
                    </Button>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Customer conversation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {detail.data?.messages.map((m) => (
                    <div key={m.id} className="rounded-lg bg-muted p-3 text-sm">
                      <p className="font-medium">{m.authorName}</p>
                      <p className="mt-1 text-muted-foreground">{m.body}</p>
                    </div>
                  ))}
                  {!detail.data?.messages.length && (
                    <p className="text-sm text-muted-foreground">No messages yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )
      )}
    </>
  );
}
