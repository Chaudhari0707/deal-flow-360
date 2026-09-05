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
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8 gap-2 px-3"
        onClick={column.getToggleSortingHandler()}
      >
        <span>{title}</span>
        {sortDirection === "desc" ? (
          <ArrowDown
            aria-hidden="true"
            className={cn("size-3.5", sortDirection ? "text-foreground" : "text-muted-foreground")}
          />
        ) : (
          <ArrowUp
            aria-hidden="true"
            className={cn("size-3.5", sortDirection ? "text-foreground" : "text-muted-foreground")}
          />
        )}
      </Button>
    </div>
  );
}
