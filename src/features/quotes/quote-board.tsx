"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, GripVertical, Lock, MoveRight } from "lucide-react";
import { toast } from "sonner";
import type { KeyedMutator } from "swr";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
import { assertQuoteAction, quoteRequest } from "@/features/quotes/client-action";
import { money } from "@/features/quotes/rules";
import type { Role } from "@/lib/domain/_types/domain";
import type { Workspace } from "@/lib/domain/_types/workspace";
import { cn } from "@/lib/utils";

type Quote = Workspace["quotes"][number];

interface PendingReason {
  columnId: BoardColumnId;
  columnLabel: string;
  quote: Quote;
}

function withQuoteStatus(
  workspace: Workspace,
  quoteId: string,
  status: Quote["status"],
): Workspace {
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
  customers: Workspace["customers"];
  role: Role;
  mutate: KeyedMutator<Workspace>;
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
          assertQuoteAction(
            await quoteRequest<{ message?: string; status?: string }>(plan.path, plan.body),
          );
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
      <div className="-mx-1 flex items-start gap-3 overflow-x-auto pb-3 md:mx-0">
        {BOARD_COLUMNS.map((column) => {
          const rows = quotes.filter((quote) => columnForStatus(quote.status) === column.id);
          const dropPlan = dragging
            ? planMove(dragging, column.id, role, "reason placeholder")
            : null;
          const isValidTarget = dropPlan?.ok === true;
          const isOver = overColumn === column.id;
          return (
            <Card
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
                "w-[min(100%,19rem)] shrink-0 overflow-visible bg-muted/30 transition-colors sm:w-80",
                isOver && isValidTarget && "ring-2 ring-primary/60",
                isOver && dragging && !isValidTarget && "ring-2 ring-destructive/40",
                dragging && !isValidTarget && "opacity-70",
                column.terminal && "bg-muted/50",
              )}
            >
              <CardHeader className="grid-rows-none">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    {column.terminal && <Lock className="size-3.5 text-muted-foreground" />}
                    {column.label}
                  </span>
                  <Badge variant="outline">{rows.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 pb-1">
                {rows.map((quote) => {
                  const locked = isTerminalStatus(quote.status);
                  const targets = locked ? [] : allowedTargetColumns(quote, role);
                  const hint = targets.length === 0 ? boardCardHint(quote, role) : null;
                  const busy = busyId === quote.id;
                  const movable = !locked && !busy && targets.length > 0;
                  return (
                    <Card
                      key={quote.id}
                      size="sm"
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
                        "overflow-visible shadow-none",
                        movable && "cursor-grab active:cursor-grabbing",
                        busy && "opacity-60",
                        dragging?.id === quote.id && "opacity-40",
                      )}
                    >
                      <CardHeader className="grid-rows-none gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            {movable ? (
                              <GripVertical
                                aria-hidden
                                className="size-3.5 text-muted-foreground"
                              />
                            ) : (
                              <Lock className="size-3" />
                            )}
                            {quote.number}
                          </p>
                          <Badge
                            variant={quote.risk === "HIGH" ? "destructive" : "secondary"}
                            className="shrink-0"
                          >
                            {quote.risk === "NONE" ? "Within policy" : `${quote.risk} risk`}
                          </Badge>
                        </div>
                        <CardTitle className="text-sm leading-5">
                          {customerName(quote.customerId)}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-lg font-semibold tabular-nums">
                          {money(quote.totalCents)}
                        </p>
                      </CardContent>
                      <CardFooter className="justify-between gap-2">
                        {hint ? (
                          <Badge variant="outline" className="max-w-44 min-w-0 gap-1 truncate">
                            {locked && <Lock className="size-3" />}
                            {hint}
                          </Badge>
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
                              <MoveRight />
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
                      </CardFooter>
                    </Card>
                  );
                })}
                {!rows.length && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {isOver && dragging
                      ? isValidTarget
                        ? `Drop ${dragging.number} here`
                        : "This stage change is not allowed"
                      : "No deals in this stage"}
                  </p>
                )}
              </CardContent>
            </Card>
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
