import { type Column, type RowData } from "@tanstack/react-table";
import { Check, type LucideIcon } from "lucide-react";

import type { DataTableFeatures } from "@/components/ui/_types/data-table";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/** Quiet label type: hierarchy from size, weight, case and letter-spacing, never from opacity. */
const eyebrowType = "text-[0.6875rem] font-medium tracking-[0.16em] uppercase";

interface DataTableFacetedFilterProps<TData extends RowData, TValue> {
  column?: Column<DataTableFeatures, TData, TValue>;
  title?: string;
  options: {
    label: string;
    value: string;
    icon?: LucideIcon;
  }[];
}

export function DataTableFacetedFilter<TData extends RowData, TValue>({
  column,
  title,
  options,
}: DataTableFacetedFilterProps<TData, TValue>) {
  "use no memo";
  const facets = column?.getFacetedUniqueValues();
  const selectedValues = new Set(column?.getFilterValue() as string[]);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn(
              eyebrowType,
              "h-8 rounded-none bg-transparent px-3 text-muted-foreground hover:text-foreground",
            )}
          />
        }
      >
        {title}
        {selectedValues?.size > 0 && (
          <>
            {/* Selection reads as text past a hairline rule rather than as a cluster of pills. */}
            <Separator orientation="vertical" className="mx-2 h-3.5 bg-border-strong" />
            <span className="text-foreground tabular-nums lg:hidden">{selectedValues.size}</span>
            <span className="hidden items-center gap-2 text-foreground lg:flex">
              {selectedValues.size > 2 ? (
                <span className="tabular-nums">{selectedValues.size} selected</span>
              ) : (
                options
                  .filter((option) => selectedValues.has(option.value))
                  .map((option) => <span key={option.value}>{option.label}</span>)
              )}
            </span>
          </>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-50 p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValues.has(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => {
                      if (isSelected) {
                        selectedValues.delete(option.value);
                      } else {
                        selectedValues.add(option.value);
                      }
                      const filterValues = Array.from(selectedValues);
                      column?.setFilterValue(filterValues.length ? filterValues : undefined);
                    }}
                  >
                    <div
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center border border-border-strong",
                        isSelected ? "bg-primary text-primary-foreground" : "[&_svg]:invisible",
                      )}
                    >
                      <Check aria-hidden="true" className="size-3" />
                    </div>
                    {option.icon ? (
                      <option.icon aria-hidden="true" className="size-4 text-muted-foreground" />
                    ) : null}
                    <span>{option.label}</span>
                    {facets?.get(option.value) && (
                      <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                        {facets.get(option.value)}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selectedValues.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => column?.setFilterValue(undefined)}
                    className={cn(eyebrowType, "justify-center text-center text-muted-foreground")}
                  >
                    Clear filters
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
