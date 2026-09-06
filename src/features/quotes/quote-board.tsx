"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, GripVertical, Lock } from "lucide-react";
import { toast } from "sonner";
import type { KeyedMutator } from "swr";

import { eyebrowType } from "@/components/editorial/editorial";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { BoardColumnId } from "@/features/quotes/_types/board";
import {
  allowedTargetColumns,
  BOARD_COLUMNS,
  boardCardHint,
  columnForStatus,
  isTerminalStatus,
  planMove,
} from "@/features/quotes/board-transitions";
import { assertQuoteAction } from "@/features/quotes/client-action";
import { RiskMark } from "@/features/quotes/quote-columns";
import { money } from "@/features/quotes/rules";
import { apiClient, apiData } from "@/lib/api/client";
import type { Role } from "@/lib/domain/_types/domain";
import type { WorkspaceResponse } from "@/lib/domain/_types/workspace";
import { cn } from "@/lib/utils";

type Quote = WorkspaceResponse["quotes"][number];

interface PendingReason {
  columnId: BoardColumnId;
  columnLabel: string;
  quote: Quote;
}

/** Quiet label type: hierarchy from size, weight, case and letter-spacing, never from opacity. */

function withQuoteStatus(
  workspace: WorkspaceResponse,
  quoteId: string,
  status: Quote["status"],
): WorkspaceResponse {
  return {
    ...workspace,
    quotes: workspace.quotes.map((quote) => (quote.id === quoteId ? { ...quote, status } : quote)),
  };
}

export function QuoteBoard({
  quotes,
  customers,
  role,
  mutate,
}: {
  quotes: Quote[];
  customers: WorkspaceResponse["customers"];
  role: Role;
  mutate: KeyedMutator<WorkspaceResponse>;
}) {
  const [dragging, setDragging] = useState<Quote | null>(null);
  const [overColumn, setOverColumn] = useState<BoardColumnId | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingReason, setPendingReason] = useState<PendingReason | null>(null);
  const [reason, setReason] = useState("");
  const reasonFieldId = useId();

  const customerName = (id: string) =>
    customers.find((customer) => customer.id === id)?.name ?? "Customer";

  async function performMove(quote: Quote, columnId: BoardColumnId, decisionReason?: string) {
    const plan = planMove(quote, columnId, role, decisionReason);
    if (!plan.ok) {
      toast.error(plan.reason);
      return;
    }
    setBusyId(quote.id);
    try {
      await mutate(
        async (current) => {
          const endpoint = apiClient.api.v1.quotes({ id: quote.id });
          const result =
            plan.action === "submit"
              ? apiData(await endpoint.submit.post({ revision: quote.revision }))
              : plan.action === "send"
                ? apiData(await endpoint.send.post({ renew: false }))
                : apiData(
                    await endpoint.approval.post({
                      action: plan.action,
                      reason: decisionReason?.trim() ?? "",
                      revision: quote.revision,
                    }),
                  );
          assertQuoteAction(result);
          if (!current) throw new Error("Workspace is not loaded.");
          return withQuoteStatus(current, quote.id, plan.optimisticStatus);
        },
        {
          optimisticData: (current) => {
            if (!current) throw new Error("Workspace is not loaded.");
            return withQuoteStatus(current, quote.id, plan.optimisticStatus);
          },
          rollbackOnError: true,
          revalidate: true,
        },
      );
      const messages: Record<typeof plan.action, string> = {
        submit: `${quote.number} submitted for approval.`,
        approve: `${quote.number} approved.`,
        return: `${quote.number} returned to draft.`,
        reject: `${quote.number} rejected.`,
        send: `${quote.number} sent to the customer.`,
      };
      toast.success(messages[plan.action]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The move could not be completed.");
    } finally {
      setBusyId(null);
    }
  }

  function requestMove(quote: Quote, columnId: BoardColumnId) {
    if (columnForStatus(quote.status) === columnId) return;
    const plan = planMove(quote, columnId, role, "reason placeholder");
    if (!plan.ok) {
      toast.error(plan.reason);
      return;
    }
    if (plan.requiresReason) {
      setReason("");
      setPendingReason({
        columnId,
        columnLabel: BOARD_COLUMNS.find((column) => column.id === columnId)?.label ?? "",
        quote,
      });
      return;
    }
    void performMove(quote, columnId);
  }

  return (
    <>
      <div className="flex items-stretch overflow-x-auto pb-2">
        {BOARD_COLUMNS.map((column) => {
          const rows = quotes.filter((quote) => columnForStatus(quote.status) === column.id);
          const dropPlan = dragging
            ? planMove(dragging, column.id, role, "reason placeholder")
            : null;
          const isValidTarget = dropPlan?.ok === true;
          const isOver = overColumn === column.id;
          return (
            <div
              key={column.id}
              data-column={column.id}
              onDragOver={(event) => {
                if (!dragging) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = isValidTarget ? "move" : "none";
                setOverColumn(column.id);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                  setOverColumn((current) => (current === column.id ? null : current));
              }}
              onDrop={(event) => {
                event.preventDefault();
                const quote = dragging;
                setDragging(null);
                setOverColumn(null);
                if (quote) requestMove(quote, column.id);
              }}
              className={cn(
                "w-[min(100%,19rem)] shrink-0 border-l border-border px-5 pb-4 transition-colors first:border-l-0 first:pl-0 sm:w-80",
                column.terminal && "bg-muted/40",
                dragging && isValidTarget && "bg-muted/60",
                isOver && isValidTarget && "bg-muted",
              )}
            >
              <div
                className={cn(
                  "flex items-baseline justify-between gap-3 border-b border-border-strong pb-2.5",
                  isOver && isValidTarget && "border-b-2 border-ink-accent",
                  isOver && dragging && !isValidTarget && "border-b-2 border-ink-risk",
                )}
              >
                <p className={cn(eyebrowType, "flex items-center gap-1.5 text-foreground")}>
                  {column.terminal && <Lock className="size-3 text-muted-foreground" />}
                  {column.label}
                </p>
                <span className="text-sm text-muted-foreground tabular-nums">{rows.length}</span>
              </div>
              {rows.map((quote) => {
                const locked = isTerminalStatus(quote.status);
                const targets = locked ? [] : allowedTargetColumns(quote, role);
                const hint = targets.length === 0 ? boardCardHint(quote, role) : null;
                const busy = busyId === quote.id;
                const movable = !locked && !busy && targets.length > 0;
                return (
                  <div
                    key={quote.id}
                    draggable={movable}
                    aria-disabled={!movable}
                    onDragStart={(event) => {
                      if (!movable) {
                        event.preventDefault();
                        return;
                      }
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", quote.id);
                      setDragging(quote);
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setOverColumn(null);
                    }}
                    className={cn(
                      "border-b border-border py-4 transition-colors",
                      movable && "cursor-grab active:cursor-grabbing",
                      busy && "bg-muted/70",
                      dragging?.id === quote.id && "bg-muted",
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-3 text-xs">
                      <p className="flex items-center gap-1.5 text-muted-foreground tabular-nums">
                        {movable ? (
                          <GripVertical aria-hidden className="size-3.5 text-muted-foreground" />
                        ) : (
                          <Lock className="size-3" />
                        )}
                        {quote.number}
                      </p>
                      <RiskMark
                        risk={quote.risk}
                        label={quote.risk === "NONE" ? "Within policy" : `${quote.risk} risk`}
                      />
                    </div>
                    <p className="mt-2.5 text-sm leading-5 text-foreground">
                      {customerName(quote.customerId)}
                    </p>
                    <p className="mt-1.5 text-xl leading-none font-medium tracking-tight text-foreground tabular-nums">
                      {money(quote.totalCents)}
                    </p>
                    <div className="mt-4 flex items-center justify-between gap-2">
                      {hint ? (
                        <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                          {locked && <Lock className="size-3 shrink-0" />}
                          <span className="truncate">{hint}</span>
                        </p>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                size="xs"
                                variant="outline"
                                disabled={busy}
                                aria-label={`Move ${quote.number} to another stage`}
                              />
                            }
                          >
                            Move
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuGroup>
                              <DropdownMenuLabel>Move to stage</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {targets.map((targetId) => (
                                <DropdownMenuItem
                                  key={targetId}
                                  variant={targetId === "rejected" ? "destructive" : "default"}
                                  onClick={() => requestMove(quote, targetId)}
                                >
                                  {BOARD_COLUMNS.find((item) => item.id === targetId)?.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        nativeButton={false}
                        render={
                          <Link
                            aria-label={`Open ${quote.number}`}
                            href={`/quotations/${quote.id}`}
                          />
                        }
                      >
                        <ArrowUpRight />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {!rows.length && (
                <p className="py-8 text-sm text-muted-foreground">
                  {isOver && dragging
                    ? isValidTarget
                      ? `Drop ${dragging.number} here`
                      : "This stage change is not allowed"
                    : "No deals in this stage"}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <AlertDialog
        open={pendingReason != null}
        onOpenChange={(open) => {
          if (!open) setPendingReason(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Move {pendingReason?.quote.number} to {pendingReason?.columnLabel}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This approval decision is recorded in the audit trail. Explain your reasoning.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field>
            <FieldLabel htmlFor={reasonFieldId}>Decision reason</FieldLabel>
            <Textarea
              id={reasonFieldId}
              value={reason}
              maxLength={1000}
              placeholder="Explain your decision"
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={reason.trim().length < 3}
              onClick={() => {
                const target = pendingReason;
                setPendingReason(null);
                if (target) void performMove(target.quote, target.columnId, reason);
              }}
            >
              Confirm move
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
