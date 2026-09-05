"use client";

import { useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, CheckCheck, ShieldCheck } from "lucide-react";
import useSWR from "swr";

import type { DataTableFeatures } from "@/components/ui/_types/data-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Separator } from "@/components/ui/separator";
import type { PortalDetail as PortalDetailData } from "@/features/portal/_types/portal";
import { PortalConversation } from "@/features/portal/portal-conversation";
import { PortalCounter } from "@/features/portal/portal-counter";
import { PortalForbidden } from "@/features/portal/portal-forbidden";
import { displayDate, displayStatus, money } from "@/features/shell/format";
import { PageHeader } from "@/features/shell/page-header";
import { WorkspaceState } from "@/features/shell/workspace-state";
import { apiClient, apiData, HttpResponseError } from "@/lib/api/client";

const columns: ColumnDef<DataTableFeatures, PortalDetailData["quote"]["lines"][number]>[] = [
  {
    accessorKey: "name",
    header: "Product / service",
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.name}</p>
        <p className="text-xs text-muted-foreground">
          {row.original.variant}
          {row.original.intervalMonths
            ? ` · Every ${row.original.intervalMonths} month(s)`
            : " · One-time"}
        </p>
      </div>
    ),
  },
  { accessorKey: "quantity", header: "Quantity" },
  {
    accessorKey: "priceCents",
    header: "Unit price",
    cell: ({ row }) => money(row.original.priceCents),
  },
  {
    accessorKey: "discountBps",
    header: "Discount",
    cell: ({ row }) => `${row.original.discountBps / 100}%`,
  },
  {
    accessorKey: "totalCents",
    header: "Total incl. tax",
    cell: ({ row }) => money(row.original.totalCents),
  },
];

export function PortalDetail({ id }: { id: string }) {
  const { data, error, mutate } = useSWR(
    `/api/v1/portal/${id}`,
    async () => apiData(await apiClient.api.v1.portal({ id }).get()),
    { refreshInterval: 15000 },
  );
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState("");
  const [notice, setNotice] = useState("");
  if (error instanceof HttpResponseError && error.status === 403) return <PortalForbidden />;
  if (error || !data)
    return (
      <WorkspaceState
        error={error}
        retry={() => {
          void mutate();
        }}
      />
    );
  const quote = data.quote;
  const recurring = [
    ...new Set(quote.lines.map((line) => line.intervalMonths).filter((months) => months > 0)),
  ]
    .sort((a, b) => a - b)
    .map((months) => ({
      label:
        months === 1
          ? "Monthly"
          : months === 3
            ? "Quarterly"
            : months === 12
              ? "Yearly"
              : `Every ${months} months`,
      cents: quote.lines
        .filter((line) => line.intervalMonths === months)
        .reduce((sum, line) => sum + line.totalCents, 0),
    }))
    .filter((cycle) => cycle.cents > 0);
  const canTransact = data.actor.role === "customer";
  const confirmable =
    canTransact &&
    ["SENT", "APPROVED", "UNDER_NEGOTIATION"].includes(quote.status) &&
    quote.approvedRevision === quote.revision;
  const negotiable =
    canTransact && ["SENT", "APPROVED", "UNDER_NEGOTIATION"].includes(quote.status);
  async function confirm() {
    setPending(true);
    setFailure("");
    setNotice("");
    try {
      apiData(await apiClient.api.v1.portal({ id }).confirm.post({ revision: quote.revision }));
      await mutate();
      setNotice(
        "Your order is confirmed. Your account manager will coordinate delivery and billing.",
      );
    } catch (problem) {
      setFailure(
        problem instanceof HttpResponseError && problem.status === 409
          ? "The quotation has changed or is awaiting approval. Refresh and review the latest version."
          : "We couldn't confirm your order. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <Button
        nativeButton={false}
        variant="ghost"
        className="self-start"
        render={<Link href="/portal" />}
      >
        <ArrowLeft />
        All quotations
      </Button>
      <PageHeader
        title={quote.number}
        description={`Prepared for ${data.customer.name} · Version ${quote.revision} · Updated ${displayDate(quote.updatedAt)}`}
        actions={
          <Badge variant={quote.status === "CONFIRMED" ? "default" : "secondary"}>
            {displayStatus(quote.status)}
          </Badge>
        }
      />
      {failure && (
        <Alert variant="destructive">
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}
      {(notice || quote.status === "CONFIRMED") && (
        <Alert role="status">
          <CheckCheck />
          <AlertTitle>Order confirmed</AlertTitle>
          <AlertDescription>
            {notice || "Thank you. Your account manager is coordinating the next steps."}
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Your quotation</CardTitle>
          <CardDescription>
            A clear breakdown of the products and services in your proposal.
          </CardDescription>
          <CardAction>
            <Badge variant="outline">INR</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <DataTable
            toolbar={(_table, extras) => <>{extras.bulkRemove}</>}
            columns={columns}
            data={quote.lines}
            getRowId={(row) => row.id}
            showPagination={false}
            enableColumnResizing={false}
            emptyMessage="This quotation has no line items."
          />
          <div className="mt-6 flex flex-col justify-between gap-6 sm:flex-row">
            <div className="max-w-md space-y-2 text-sm">
              <p className="font-medium">Delivery & notes</p>
              <p className="text-muted-foreground">
                {quote.promisedDate
                  ? `Requested delivery: ${displayDate(quote.promisedDate)}`
                  : "Delivery timing will be confirmed by your account manager."}
              </p>
            </div>
            <div className="w-full space-y-3 text-sm sm:w-72">
              <div className="flex justify-between">
                <span>One-time subtotal</span>
                <span>{money(quote.subtotalCents)}</span>
              </div>
              <div className="flex justify-between">
                <span>One-time tax</span>
                <span>{money(quote.taxCents)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-semibold">
                <span>One-time total</span>
                <span>{money(quote.totalCents)}</span>
              </div>
              {recurring.length > 0 && (
                <>
                  <Separator />
                  <p className="font-medium">Recurring plans (including tax)</p>
                  {recurring.map((cycle) => (
                    <div key={cycle.label} className="flex justify-between">
                      <span>{cycle.label}</span>
                      <span>{money(cycle.cents)}</span>
                    </div>
                  ))}
                </>
              )}
              {quote.orderDiscountBps > 0 && (
                <p className="text-xs text-muted-foreground">
                  Includes {quote.orderDiscountBps / 100}% order discount.
                </p>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex-wrap justify-between gap-4">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-4" />
            {confirmable
              ? "This version is approved and ready to confirm."
              : quote.status === "CONFIRMED"
                ? "This quotation has been converted to an order."
                : "Your account manager is reviewing this quotation."}
          </p>
          {confirmable && (
            <AlertDialog>
              <AlertDialogTrigger render={<Button disabled={pending} />}>
                <CheckCheck />
                Confirm order
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm {quote.number}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You are accepting version {quote.revision} with {money(quote.totalCents)} in
                    one-time charges
                    {recurring.length
                      ? ` plus ${recurring.map((cycle) => `${money(cycle.cents)} ${cycle.label.toLowerCase()}`).join(" and ")}`
                      : ""}
                    . This creates your order and starts fulfillment and billing.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Review again</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      void confirm();
                    }}
                  >
                    Confirm this order
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardFooter>
      </Card>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <PortalConversation data={data} saved={mutate} />
        {negotiable && <PortalCounter key={quote.revision} data={data} saved={mutate} />}
      </div>
    </>
  );
}
