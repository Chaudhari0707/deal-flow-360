import { type RowData, type Table } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import { eyebrowType } from "@/components/editorial/editorial";
import type { DataTableFeatures } from "@/components/ui/_types/data-table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Quiet label type: hierarchy from size, weight, case and letter-spacing, never from opacity. */

/** Square, transparent step controls — the hairline is the boundary, not a filled pill. */
const stepButton = "size-8 rounded-none bg-transparent";

/**
 * Compact page navigation for the top right of a table, in the shape a reader already knows from
 * their mail client: the visible range, the total, and one step in each direction. It sits above
 * the scrolling rows so it stays put while the body moves.
 */
export function DataTablePageNav<TData extends RowData>({
  className,
  table,
}: DataTablePaginationProps<TData>) {
  "use no memo";
  const { pageIndex, pageSize } = table.store.state.pagination;
  const total = table.getFilteredRowModel().rows.length;
  const first = total === 0 ? 0 : pageIndex * pageSize + 1;
  const last = Math.min(total, (pageIndex + 1) * pageSize);
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Select
        value={`${pageSize}`}
        onValueChange={(value) => {
          table.setPageSize(Number(value));
        }}
      >
        <SelectTrigger
          aria-label="Rows per page"
          className="h-7 w-14 rounded-none border-0 bg-transparent px-1 text-xs text-muted-foreground tabular-nums"
        >
          <SelectValue placeholder={pageSize} />
        </SelectTrigger>
        <SelectContent side="bottom">
          <SelectGroup>
            {[10, 20, 25, 30, 40, 50].map((size) => (
              <SelectItem key={size} value={`${size}`}>
                {size}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <p className="mr-1 text-xs text-muted-foreground tabular-nums">
        {first}–{last} of {total}
      </p>
      <Button
        variant="ghost"
        size="icon-sm"
        className={cn(stepButton, "size-7")}
        onClick={() => table.previousPage()}
        disabled={!table.getCanPreviousPage()}
      >
        <span className="sr-only">Go to previous page</span>
        <ChevronLeft aria-hidden="true" className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className={cn(stepButton, "size-7")}
        onClick={() => table.nextPage()}
        disabled={!table.getCanNextPage()}
      >
        <span className="sr-only">Go to next page</span>
        <ChevronRight aria-hidden="true" className="size-4" />
      </Button>
    </div>
  );
}

interface DataTablePaginationProps<TData extends RowData> {
  className?: string;
  table: Table<DataTableFeatures, TData>;
}

export function DataTablePagination<TData extends RowData>({
  className,
  table,
}: DataTablePaginationProps<TData>) {
  "use no memo";
  const showSelectionSummary = table.getAllLeafColumns().some((column) => column.id === "select");

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t border-border pt-4",
        className,
      )}
    >
      {showSelectionSummary ? (
        <div className="flex-1 text-xs text-muted-foreground tabular-nums">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
      ) : (
        <div className="flex-1" />
      )}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div className="flex items-center gap-3">
          <p className={cn(eyebrowType, "text-muted-foreground")}>Rows per page</p>
          <Select
            value={`${table.store.state.pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger className="h-8 w-16 pl-2 text-sm tabular-nums">
              <SelectValue placeholder={table.store.state.pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              <SelectGroup>
                {[10, 20, 25, 30, 40, 50].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <p className={cn(eyebrowType, "min-w-30 text-center text-foreground tabular-nums")}>
          Page {table.store.state.pagination.pageIndex + 1} of {table.getPageCount()}
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className={cn(stepButton, "hidden lg:flex")}
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">Go to first page</span>
            <ChevronsLeft aria-hidden="true" className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className={stepButton}
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">Go to previous page</span>
            <ChevronLeft aria-hidden="true" className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className={stepButton}
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">Go to next page</span>
            <ChevronRight aria-hidden="true" className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className={cn(stepButton, "hidden lg:flex")}
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">Go to last page</span>
            <ChevronsRight aria-hidden="true" className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
