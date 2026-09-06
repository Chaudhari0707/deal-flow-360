"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import useSWR from "swr";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { QuoteConversation } from "@/features/quotes/quote-conversation";
import { QuoteDocument } from "@/features/quotes/quote-document";
import { QuoteEditor } from "@/features/quotes/quote-editor";
import { Eyebrow, eyebrowType, ruledControl } from "@/features/quotes/quote-editorial";
import { PageHeader } from "@/features/shell/page-header";
import { useWorkspace } from "@/features/shell/use-workspace";
import { WorkspaceState } from "@/features/shell/workspace-state";
import { apiClient, apiData } from "@/lib/api/client";
import { cn } from "@/lib/utils";

const backLink = cn(
  eyebrowType,
  "h-auto rounded-none px-0 text-muted-foreground hover:bg-transparent hover:text-foreground dark:hover:bg-transparent",
);

export function QuoteDetail({ isNew = false }: { isNew?: boolean }) {
  const router = useRouter();
  const params = useParams<{ id: string }>(),
    { data, error, mutate } = useWorkspace();
  const detail = useSWR(!isNew && params.id ? `/api/v1/quotes/${params.id}` : null, async () =>
    apiData(await apiClient.api.v1.quotes({ id: params.id }).get()),
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
      <PageHeader
        title="Quotation not found"
        description="Refresh the workspace or return to your pipeline."
        actions={
          <Button nativeButton={false} render={<Link href="/quotations" />}>
            Back to quotations
          </Button>
        }
      />
    );
  const canEdit = data.actor.role === "rep";
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
      const saved = apiData(
        await apiClient.api.v1.quotes.post({
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
        }),
        "The action failed. Refresh and try again.",
      );
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
      const endpoint = apiClient.api.v1.quotes({ id: quote.id });
      const fallback = "The action failed. Refresh and try again.";
      const result =
        action === "send"
          ? apiData(
              await endpoint.send.post({
                renew: quote.status === "SENT" || quote.status === "UNDER_NEGOTIATION",
              }),
              fallback,
            )
          : action === "submit"
            ? apiData(await endpoint.submit.post({ revision: quote.revision }), fallback)
            : apiData(
                await endpoint.approval.post({ revision: quote.revision, action, reason }),
                fallback,
              );
      if (result.status === "FAILED")
        setFailure(
          ("message" in result ? result.message : undefined) ??
            "Email delivery failed; retry after checking configuration.",
        );
      else setNotice(action === "send" ? "Email accepted by provider." : "Quotation updated.");
      await onSaved();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Action failed");
    } finally {
      setPending(false);
    }
  }
  const reviewer = quote?.status === "PENDING_APPROVAL" && data.actor.role === quote.approvalStep;
  const approved = quote?.approvedRevision === quote?.revision && quote !== undefined;
  return (
    <>
      <div>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          className={backLink}
          render={<Link href="/quotations" />}
        >
          <ArrowLeft />
          All quotations
        </Button>
      </div>
      <PageHeader
        eyebrow={quote ? quote.status.replaceAll("_", " ") : undefined}
        title={isNew ? "New quotation" : quote!.number}
        description={
          isNew
            ? "Build the right offer with pricing you can explain."
            : `${customer?.name ?? "Customer"} · ${customer?.tier ?? ""} tier · Revision ${quote!.revision}`
        }
        actions={
          quote && canEdit ? (
            <div className="flex flex-wrap items-center gap-3">
              {["CONFIRMED", "REJECTED"].includes(quote.status) ? (
                <Button variant="outline" disabled={pending} onClick={() => void duplicate()}>
                  Copy to new draft
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setEditing((v) => !v)}>
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
          <div className="grid items-start gap-x-14 gap-y-12 xl:grid-cols-[minmax(0,1fr)_340px]">
            <QuoteDocument activity={detail.data?.activity ?? []} quote={quote} />
            <div className="space-y-12">
              <section className="border-t-2 border-foreground pt-6">
                <Eyebrow>Current approval risk</Eyebrow>
                <p
                  className={cn(
                    "mt-3 text-[1.75rem] leading-none font-medium tracking-tight tabular-nums",
                    quote.risk === "HIGH" ? "text-ink-risk" : "text-foreground",
                  )}
                >
                  {quote.risk}
                </p>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  {approved
                    ? "This revision is approved. Customer confirmation may proceed."
                    : quote.approvalStep
                      ? `Waiting for ${quote.approvalStep === "finance" ? "Finance" : "Sales Manager"}.`
                      : "Approval follows the current commercial revision."}
                </p>
                {reviewer && (
                  <div className="mt-6 border-t border-border pt-6">
                    <Field>
                      <FieldLabel
                        htmlFor="approval-reason"
                        className={cn(eyebrowType, "text-muted-foreground")}
                      >
                        Decision reason
                      </FieldLabel>
                      <Input
                        id="approval-reason"
                        placeholder="Explain your decision"
                        maxLength={1000}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className={ruledControl}
                      />
                    </Field>
                    <div className="mt-6 flex flex-wrap items-center gap-5">
                      <Button
                        disabled={pending || reason.trim().length < 3}
                        onClick={() => void act("approve")}
                      >
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
                        Reject
                      </Button>
                    </div>
                  </div>
                )}
                {approved &&
                  ["rep", "manager", "finance"].includes(data.actor.role) &&
                  quote.status !== "CONFIRMED" && (
                    <Button
                      className="mt-6 w-full"
                      disabled={pending}
                      onClick={() => void act("send")}
                    >
                      Send quotation email
                    </Button>
                  )}
                {quote.status === "CONFIRMED" && (
                  <Button
                    className="mt-6"
                    nativeButton={false}
                    render={<Link href="/fulfillment" />}
                  >
                    View fulfillment
                  </Button>
                )}
              </section>
              <QuoteConversation
                canReply={["finance", "manager", "rep"].includes(data.actor.role)}
                lines={quote.lines}
                messages={detail.data?.messages ?? []}
                quoteId={quote.id}
                saved={async () => {
                  await mutate();
                  await detail.mutate();
                }}
              />
            </div>
          </div>
        )
      )}
    </>
  );
}
