"use client";

import * as React from "react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnPinningState,
  type ColumnVisibilityState,
  type OnChangeFn,
  type PaginationState,
  type RowData,
  type SortingState,
  type Table,
  useTable,
} from "@tanstack/react-table";

import type {
  DataTableApplyCellToAllRowsArgs,
  DataTableBulkRemoveCopy,
  DataTableColumnMeta,
  DataTableFeatures,
  DataTableToolbarExtras,
} from "@/components/ui/_types/data-table";
import { Checkbox } from "@/components/ui/checkbox";
import { CopyButton } from "@/components/ui/copy-button";
import { ApplyCellValueToAllButton } from "@/components/ui/data-table/apply-cell-value-to-all-button";
import { DataTableBulkRemove } from "@/components/ui/data-table/data-table-bulk-remove";
import { DataTableDefaultToolbar } from "@/components/ui/data-table/data-table-default-toolbar";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import {
  columnPinningKey,
  getDataTablePinningStyles,
  resolveInitialColumnPinning,
} from "@/components/ui/data-table/data-table-pinning";
import { dataTableFeatures } from "@/components/ui/data-table/features";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Table as UITable,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

function getSelectionColumn<TData extends RowData>(): ColumnDef<DataTableFeatures, TData> {
  return {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={table.getIsSomePageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all rows"
        className="translate-y-0.5"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="translate-y-0.5"
      />
    ),
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    size: 44,
    minSize: 44,
    maxSize: 44,
  };
}

function hasSelectionColumn<TData extends RowData, TValue>(
  columns: ColumnDef<DataTableFeatures, TData, TValue>[],
) {
  return columns.some((column) => "id" in column && column.id === "select");
}

interface DataTableProps<TData extends RowData, TValue> {
  bulkRemovePending?: boolean;
  columns: ColumnDef<DataTableFeatures, TData, TValue>[];
  data: TData[];
  /**
   * Default true when `enableSelection` is on. Set false for read-only multi-select.
   */
  enableBulkRemove?: boolean;
  enableColumnResizing?: boolean;
  enableSelection?: boolean;
  emptyMessage?: string;
  getBulkRemoveCopy?: (rows: TData[]) => DataTableBulkRemoveCopy;
  getRowId?: (originalRow: TData, index: number) => string;
  /**
   * Server-driven pagination: `data` is only the current page's rows (already fetched with
   * real `.limit()/.offset()`), and `pageCount` + `pagination`/`onPaginationChange` are
   * required together. Omit all three (default) for the existing client-side mode, where
   * `data` is the full array and the table slices it in the browser — only appropriate for
   * inherently small/bounded lists. See `.agents/data-table.md`.
   */
  manualPagination?: boolean;
  onApplyCellToAllRows?: (args: DataTableApplyCellToAllRowsArgs<TData>) => void;
  onBulkArchive?: (rows: TData[]) => boolean | void | Promise<boolean | void>;
  /**
   * Required whenever selection + bulk remove are enabled (default with `enableSelection`).
   */
  onBulkDelete?: (rows: TData[]) => boolean | void | Promise<boolean | void>;
  onPaginationChange?: OnChangeFn<PaginationState>;
  onRowClick?: (row: TData) => void;
  /** Required when `manualPagination` is true — total page count from the server's `total`/`count()`. */
  pageCount?: number;
  /** Controlled pagination state — required when `manualPagination` is true. */
  pagination?: PaginationState;
  /** Initial rows per page in client-side mode (default 25). Ignored when `manualPagination` is true. */
  pageSize?: number;
  /** Hide pagination chrome (useful for compact/form-embedded tables). Default true. */
  showPagination?: boolean;
  toolbar?: (
    table: Table<DataTableFeatures, TData>,
    extras: DataTableToolbarExtras,
  ) => React.ReactNode;
}

export function DataTable<TData extends RowData, TValue>({
  columns,
  data,
  toolbar,
  emptyMessage = "No results.",
  enableSelection = false,
  enableBulkRemove,
  enableColumnResizing = true,
  manualPagination = false,
  onApplyCellToAllRows,
  onRowClick,
  onBulkDelete,
  onBulkArchive,
  onPaginationChange,
  getBulkRemoveCopy,
  getRowId,
  bulkRemovePending = false,
  pageCount,
  pagination,
  pageSize = 25,
  showPagination = true,
}: DataTableProps<TData, TValue>) {
  "use no memo";
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const resolvedColumns =
    enableSelection && !hasSelectionColumn(columns)
      ? ([getSelectionColumn<TData>(), ...columns] as ColumnDef<DataTableFeatures, TData, TValue>[])
      : columns;

  const bulkRemoveEnabled = enableBulkRemove ?? enableSelection;

  const [columnPinning, setColumnPinning] = React.useState<ColumnPinningState>(() =>
    resolveInitialColumnPinning(resolvedColumns),
  );

  // Sticky metadata can change after mount when async column definitions arrive.
  const derivedColumnPinning = resolveInitialColumnPinning(resolvedColumns);
  const derivedPinningKey = columnPinningKey(derivedColumnPinning);
  const [pinningBaselineKey, setPinningBaselineKey] = React.useState(derivedPinningKey);
  if (derivedPinningKey !== pinningBaselineKey) {
    setPinningBaselineKey(derivedPinningKey);
    setColumnPinning(derivedColumnPinning);
  }

  const table = useTable({
    features: dataTableFeatures,
    data,
    columns: resolvedColumns as ColumnDef<DataTableFeatures, TData, unknown>[],
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      columnPinning,
      ...(manualPagination ? { pagination } : {}),
    },
    initialState: manualPagination
      ? undefined
      : {
          pagination: {
            pageIndex: 0,
            pageSize: showPagination ? pageSize : Math.max(data.length, pageSize),
          },
        },
    defaultColumn: {
      minSize: 72,
      size: 160,
      maxSize: 480,
    },
    enableRowSelection: enableSelection,
    enableColumnResizing,
    columnResizeMode: "onChange",
    enableSortingRemoval: false,
    getRowId,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnPinningChange: setColumnPinning,
    // Spread these in only for manual mode. Passing them as explicit `undefined` is NOT
    // equivalent to omitting them: TanStack merges options with `{...prev, ...next}`, so an
    // explicit `undefined` overwrites `rowPaginationFeature`'s default `onPaginationChange`
    // state updater, silently turning `setPageSize`/`setPageIndex` into no-ops
    // (`setStateSlice` bails on a falsy handler) for every client-paginated table.
    ...(manualPagination ? { manualPagination, onPaginationChange, pageCount } : {}),
  });

  React.useEffect(() => {
    if (!showPagination && !manualPagination) {
      table.setPageSize(Math.max(data.length, 1));
    }
  }, [data.length, manualPagination, showPagination, table]);

  const hasPinnedColumns =
    (columnPinning.start?.length ?? 0) > 0 || (columnPinning.end?.length ?? 0) > 0;

  const bulkRemoveAction =
    bulkRemoveEnabled && onBulkDelete ? (
      <DataTableBulkRemove
        table={table}
        onBulkDelete={onBulkDelete}
        onBulkArchive={onBulkArchive}
        getBulkRemoveCopy={getBulkRemoveCopy}
        bulkRemovePending={bulkRemovePending}
      />
    ) : null;

  const toolbarExtras: DataTableToolbarExtras = { bulkRemove: bulkRemoveAction };

  return (
    <div className="flex flex-col gap-4">
      {toolbar ? (
        toolbar(table, toolbarExtras)
      ) : (
        <DataTableDefaultToolbar table={table} actions={bulkRemoveAction} />
      )}
      <div
        className={cn(
          "overflow-y-hidden rounded-md border",
          hasPinnedColumns ? "overflow-x-auto" : "overflow-x-auto",
        )}
      >
        <UITable
          style={{
            width: "100%",
            ...(enableColumnResizing || hasPinnedColumns ? { minWidth: table.getTotalSize() } : {}),
          }}
        >
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const pinningStyles = getDataTablePinningStyles(header.column);
                  const isPinned = header.column.getIsPinned();

                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className={cn(
                        enableColumnResizing && "relative",
                        isPinned &&
                          "bg-background group-hover/table-row:bg-muted/50 group-data-[state=selected]/table-row:bg-muted",
                      )}
                      style={{
                        ...(enableColumnResizing
                          ? {
                              width: header.getSize(),
                              minWidth: header.getSize(),
                            }
                          : {}),
                        ...pinningStyles,
                      }}
                    >
                      {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                      {enableColumnResizing &&
                      !header.isPlaceholder &&
                      header.column.getCanResize() ? (
                        <button
                          type="button"
                          onDoubleClick={() => header.column.resetSize()}
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          aria-label={`Resize ${header.column.id} column`}
                          className={cn(
                            "absolute top-0 right-0 z-10 h-full w-2 cursor-col-resize touch-none select-none",
                            "after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border/80",
                            header.column.getIsResizing() && "after:bg-primary",
                          )}
                        />
                      ) : null}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn(onRowClick && "cursor-pointer")}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onRowClick(row.original);
                          }
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                >
                  {row.getVisibleCells().map((cell) => {
                    const pinningStyles = getDataTablePinningStyles(cell.column);
                    const isPinned = cell.column.getIsPinned();
                    const columnMeta = cell.column.columnDef.meta as
                      | DataTableColumnMeta<TData>
                      | undefined;
                    const copyValue = columnMeta?.copyValue;
                    const applyToAll = columnMeta?.applyToAll;
                    const copyLabel = columnMeta?.label ?? cell.column.id;
                    const applyLabel = applyToAll?.fieldLabel ?? copyLabel;
                    const canApplyToAll = applyToAll && onApplyCellToAllRows && data.length > 1;

                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          isPinned &&
                            "bg-background group-hover/table-row:bg-muted/50 group-data-[state=selected]/table-row:bg-muted",
                        )}
                        style={{
                          ...(enableColumnResizing
                            ? {
                                width: cell.column.getSize(),
                                minWidth: cell.column.getSize(),
                              }
                            : {}),
                          ...pinningStyles,
                        }}
                      >
                        {copyValue || canApplyToAll ? (
                          <div className="flex min-w-0 items-center gap-1.5">
                            <div className="min-w-0 flex-1">
                              <table.FlexRender cell={cell} />
                            </div>
                            {canApplyToAll ? (
                              <ApplyCellValueToAllButton
                                fieldLabel={applyLabel}
                                onApply={() =>
                                  onApplyCellToAllRows({
                                    columnId: cell.column.id,
                                    sourceRow: row.original,
                                    sourceRowIndex: row.index,
                                    value: applyToAll.getValue(row.original),
                                  })
                                }
                              />
                            ) : null}
                            {copyValue ? (
                              <CopyButton
                                value={copyValue(row.original)}
                                aria-label={`Copy ${copyLabel}`}
                                className="opacity-0 group-hover/table-row:opacity-100 focus-visible:opacity-100"
                              />
                            ) : null}
                          </div>
                        ) : (
                          <table.FlexRender cell={cell} />
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={resolvedColumns.length} className="h-24 text-center">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </UITable>
      </div>
      {showPagination ? <DataTablePagination table={table} /> : null}
    </div>
  );
}
