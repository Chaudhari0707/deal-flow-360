"use client";

import { type ReactNode, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft } from "lucide-react";
import useSWR from "swr";

import { eyebrowType } from "@/components/editorial/editorial";
import type { DataTableFeatures } from "@/components/ui/_types/data-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogBody,
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
import type { DataTableClassNames } from "@/components/ui/data-table";
import { DataTable } from "@/components/ui/data-table";
import type { PortalDetail as PortalDetailData } from "@/features/portal/_types/portal";
import { PortalConversation } from "@/features/portal/portal-conversation";
import { PortalCounter } from "@/features/portal/portal-counter";
import { PortalForbidden } from "@/features/portal/portal-forbidden";
import { displayDate, displayStatus, money } from "@/features/shell/format";
import { PageHeader } from "@/features/shell/page-header";
import { WorkspaceState } from "@/features/shell/workspace-state";
import { apiClient, apiData, HttpResponseError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

/** Quiet label type: hierarchy from size, weight, case and letter-spacing, never from opacity. */

/**
 * The quotation is a document the customer reads, so the shared DataTable keeps its behaviour
 * while its chrome becomes a rule under letterspaced headers, hairline rows and tabular money.
 */
const documentStyles: DataTableClassNames = {
  cell: "px-0 py-4 pr-8 align-top whitespace-normal last:pr-0",
  emptyCell: "px-0 text-left text-muted-foreground",
  head: "h-auto px-0 pt-0 pr-8 pb-3 text-[0.6875rem] tracking-[0.16em] last:pr-0",
  row: "border-0 hover:bg-transparent",
  table: "text-sm",
};

/** Money and counts are the primary visual element: right-aligned, tabular, comparable. */
function Numeric({ children, quiet = false }: { children: ReactNode; quiet?: boolean }) {
  return (
    <span
      className={cn(
        "block text-right tabular-nums",
        quiet ? "text-muted-foreground" : "font-medium text-foreground",
      )}
    >
      {children}
    </span>
  );
}

function NumericHeader({ children }: { children: ReactNode }) {
  return <span className="block text-right">{children}</span>;
}

/** One row of the totals block. The closing figure sits above a firm rule, not inside a box. */
function TotalLine({
  label,
  strong = false,
  value,
}: {
  label: string;
  strong?: boolean;
  value: string;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-8",
        strong ? "mt-1 border-t-2 border-foreground pt-3.5" : "border-b border-border py-2.5",
      )}
    >
      <dt className={strong ? cn(eyebrowType, "text-muted-foreground") : "text-muted-foreground"}>
        {label}
      </dt>
      <dd
        className={cn(
          "tabular-nums",
          strong ? "text-lg font-semibold text-foreground" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

const columns: ColumnDef<DataTableFeatures, PortalDetailData["quote"]["lines"][number]>[] = [
  {
    accessorKey: "name",
    header: "Product / service",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="font-medium text-foreground">{row.original.name}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {row.original.variant}
          {row.original.intervalMonths
            ? ` · Every ${row.original.intervalMonths} month(s)`
            : " · One-time"}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "quantity",
    header: () => <NumericHeader>Quantity</NumericHeader>,
    cell: ({ row }) => <Numeric quiet>{row.original.quantity}</Numeric>,
  },
  {
    accessorKey: "priceCents",
    header: () => <NumericHeader>Unit price</NumericHeader>,
    cell: ({ row }) => <Numeric quiet>{money(row.original.priceCents)}</Numeric>,
  },
  {
    accessorKey: "discountBps",
    header: () => <NumericHeader>Discount</NumericHeader>,
    cell: ({ row }) => <Numeric quiet>{`${row.original.discountBps / 100}%`}</Numeric>,
  },
  {
    accessorKey: "totalCents",
    header: () => <NumericHeader>Total incl. tax</NumericHeader>,
    cell: ({ row }) => <Numeric>{money(row.original.totalCents)}</Numeric>,
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
        className={cn(
          eyebrowType,
          "h-auto self-start rounded-none px-0 py-1 text-muted-foreground hover:bg-transparent hover:text-foreground",
        )}
        render={<Link href="/portal" />}
      >
        <ArrowLeft className="size-3.5" />
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
        <Alert variant="destructive" className="max-w-[68ch]">
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}
      {(notice || quote.status === "CONFIRMED") && (
        <Alert role="status" className="max-w-[68ch]">
          <AlertTitle>Order confirmed</AlertTitle>
          <AlertDescription>
            {notice || "Thank you. Your account manager is coordinating the next steps."}
          </AlertDescription>
        </Alert>
      )}
      <section className="mt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-b border-border-strong pb-3">
          <h2 className={cn(eyebrowType, "text-foreground")}>Your quotation</h2>
          <p className={cn(eyebrowType, "text-muted-foreground")}>INR</p>
        </div>
        <p className="mt-5 max-w-[62ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
          A clear breakdown of the products and services in your proposal.
        </p>
        <div className="mt-8">
          <DataTable
            classNames={documentStyles}
            toolbar={(_table, extras) => (
              <>
                {extras.bulkRemove}
                {extras.pageNav ? (
                  <div className="flex items-center justify-end">{extras.pageNav}</div>
                ) : null}
              </>
            )}
            columns={columns}
            data={quote.lines}
            getRowId={(row) => row.id}
            showPagination={false}
            enableColumnResizing={false}
            emptyMessage="This quotation has no line items."
          />
        </div>
        <div className="mt-10 flex flex-col gap-x-16 gap-y-10 sm:flex-row sm:justify-between">
          <div className="max-w-[46ch]">
            <p className={cn(eyebrowType, "text-muted-foreground")}>Delivery & notes</p>
            <p className="mt-3 text-sm leading-relaxed text-foreground">
              {quote.promisedDate
                ? `Requested delivery: ${displayDate(quote.promisedDate)}`
                : "Delivery timing will be confirmed by your account manager."}
            </p>
          </div>
          <div className="w-full shrink-0 text-sm sm:w-80">
            <dl>
              <TotalLine label="One-time subtotal" value={money(quote.subtotalCents)} />
              <TotalLine label="One-time tax" value={money(quote.taxCents)} />
              <TotalLine strong label="One-time total" value={money(quote.totalCents)} />
            </dl>
            {recurring.length > 0 && (
              <div className="mt-8">
                <p
                  className={cn(eyebrowType, "border-b border-border pb-2.5 text-muted-foreground")}
                >
                  Recurring plans (including tax)
                </p>
                <dl>
                  {recurring.map((cycle) => (
                    <TotalLine key={cycle.label} label={cycle.label} value={money(cycle.cents)} />
                  ))}
                </dl>
              </div>
            )}
            {quote.orderDiscountBps > 0 && (
              <p className="mt-4 text-xs text-muted-foreground">
                Includes {quote.orderDiscountBps / 100}% order discount.
              </p>
            )}
          </div>
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-x-10 gap-y-5 border-t border-border-strong pt-6">
          <p className="max-w-[58ch] text-sm text-muted-foreground">
            {confirmable
              ? "This version is approved and ready to confirm."
              : quote.status === "CONFIRMED"
                ? "This quotation has been converted to an order."
                : "Your account manager is reviewing this quotation."}
          </p>
          {confirmable && (
            <AlertDialog>
              <AlertDialogTrigger render={<Button size="lg" disabled={pending} />}>
                Confirm order
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm {quote.number}?</AlertDialogTitle>
                </AlertDialogHeader>
                <AlertDialogBody className="max-h-[45svh]">
                  <AlertDialogDescription className="leading-relaxed">
                    You are accepting version {quote.revision} with {money(quote.totalCents)} in
                    one-time charges
                    {recurring.length
                      ? ` plus ${recurring.map((cycle) => `${money(cycle.cents)} ${cycle.label.toLowerCase()}`).join(" and ")}`
                      : ""}
                    . This creates your order and starts fulfillment and billing.
                  </AlertDialogDescription>
                </AlertDialogBody>
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
        </div>
      </section>
      <div className="mt-6 grid items-start gap-x-14 gap-y-12 lg:grid-cols-2">
        <PortalConversation data={data} saved={mutate} />
        {negotiable && <PortalCounter key={quote.revision} data={data} saved={mutate} />}
      </div>
    </>
  );
}
