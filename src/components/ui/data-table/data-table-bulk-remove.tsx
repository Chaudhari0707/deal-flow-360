"use client";

import { useState } from "react";
import type { RowData, Table } from "@tanstack/react-table";

import type { DataTableBulkRemoveCopy, DataTableFeatures } from "@/components/ui/_types/data-table";
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
import { cn } from "@/lib/utils";

/** Quiet label type: hierarchy from size, weight, case and letter-spacing, never from opacity. */
const eyebrowType = "text-[0.6875rem] font-medium tracking-[0.16em] uppercase";

type DataTableBulkRemoveProps<TData extends RowData> = {
  bulkRemovePending?: boolean;
  getBulkRemoveCopy?: (rows: TData[]) => DataTableBulkRemoveCopy;
  onBulkArchive?: (rows: TData[]) => boolean | void | Promise<boolean | void>;
  onBulkDelete: (rows: TData[]) => boolean | void | Promise<boolean | void>;
  table: Table<DataTableFeatures, TData>;
};

function defaultCopy<TData extends RowData>(rows: TData[]): DataTableBulkRemoveCopy {
  const count = rows.length;
  return {
    deleteLabel: count === 1 ? "Delete" : "Delete selected",
    description: `Permanently delete ${count} selected ${count === 1 ? "item" : "items"}? This cannot be undone.`,
    title: `Remove ${count} ${count === 1 ? "item" : "items"}?`,
  };
}

export function DataTableBulkRemove<TData extends RowData>({
  bulkRemovePending = false,
  getBulkRemoveCopy,
  onBulkArchive,
  onBulkDelete,
  table,
}: DataTableBulkRemoveProps<TData>) {
  "use no memo";

  const [open, setOpen] = useState(false);
  const selectedRows = table.getFilteredSelectedRowModel().rows.map((row) => row.original);
  if (selectedRows.length === 0) return null;

  const copy = getBulkRemoveCopy?.(selectedRows) ?? defaultCopy(selectedRows);
  const impactRows = (copy.impactRows ?? []).filter((row) => row.count > 0);
  const hasImpact = impactRows.length > 0 || copy.impactFooter != null;

  async function complete(action: (rows: TData[]) => boolean | void | Promise<boolean | void>) {
    const result = await action(selectedRows);
    if (result !== false) table.resetRowSelection();
    setOpen(false);
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        className={cn(eyebrowType, "h-8 rounded-none px-3")}
        disabled={bulkRemovePending}
        onClick={() => setOpen(true)}
      >
        Remove {selectedRows.length}
      </Button>
      <AlertDialogContent className={hasImpact ? "sm:max-w-lg" : undefined}>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        </AlertDialogHeader>
        {hasImpact ? (
          <div className="w-full space-y-3 text-left">
            {copy.impactTitle ? (
              <p className={cn(eyebrowType, "text-muted-foreground")}>{copy.impactTitle}</p>
            ) : null}
            {impactRows.length > 0 ? (
              /* Impact reads as a hairline-divided figure band: labels quiet, counts tabular. */
              <ul className="max-h-40 divide-y divide-border overflow-y-auto border-y border-border text-sm">
                {impactRows.map((row) => (
                  <li key={row.label} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-medium text-foreground tabular-nums">
                      {row.count.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {copy.impactFooter}
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={bulkRemovePending}>Cancel</AlertDialogCancel>
          {onBulkArchive ? (
            <Button
              type="button"
              variant="outline"
              disabled={copy.archiveDisabled || bulkRemovePending}
              onClick={() => void complete(onBulkArchive)}
            >
              {copy.archiveLabel ?? "Archive selected"}
            </Button>
          ) : null}
          <AlertDialogAction
            variant="destructive"
            disabled={bulkRemovePending}
            onClick={(event) => {
              event.preventDefault();
              void complete(onBulkDelete);
            }}
          >
            {copy.deleteLabel ?? "Delete selected"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
