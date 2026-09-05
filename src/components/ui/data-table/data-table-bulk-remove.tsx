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
          <div className="w-full space-y-2 text-left">
            {copy.impactTitle ? <p className="text-sm font-medium">{copy.impactTitle}</p> : null}
            {impactRows.length > 0 ? (
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border bg-muted/40 px-3 py-2 text-sm">
                {impactRows.map((row) => (
                  <li key={row.label} className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-medium tabular-nums">{row.count.toLocaleString()}</span>
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
