import { type Column, type RowData } from "@tanstack/react-table";
import { ArrowDown, ArrowUp } from "lucide-react";

import type { DataTableFeatures } from "@/components/ui/_types/data-table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DataTableColumnHeaderProps<
  TData extends RowData,
  TValue,
> extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<DataTableFeatures, TData, TValue>;
  title: string;
}

export function DataTableColumnHeader<TData extends RowData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  "use no memo";

  const sortDirection = column.getIsSorted();

  if (!column.getCanSort()) {
    return <div className={cn("flex items-center gap-2", className)}>{title}</div>;
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* The control inherits the header cell's letterspaced type: sorting must not introduce a
          second, louder label style next to plain string headers in the same row. */}
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "-ml-3 h-8 gap-1.5 rounded-none px-3 text-xs font-medium tracking-[0.08em] uppercase hover:bg-transparent",
          sortDirection ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
        onClick={column.getToggleSortingHandler()}
      >
        <span>{title}</span>
        <span className="flex w-3 shrink-0 items-center justify-center">
          {sortDirection === "desc" ? (
            <ArrowDown aria-hidden="true" className="size-3" />
          ) : (
            <ArrowUp
              aria-hidden="true"
              className={cn(
                "size-3",
                !sortDirection &&
                  "opacity-0 transition-opacity group-hover/button:opacity-100 group-focus-visible/button:opacity-100",
              )}
            />
          )}
        </span>
      </Button>
    </div>
  );
}
