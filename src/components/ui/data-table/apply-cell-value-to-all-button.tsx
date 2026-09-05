"use client";

import { Layers } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type ApplyCellValueToAllButtonProps = {
  className?: string;
  disabled?: boolean;
  fieldLabel: string;
  onApply: () => void;
};

/**
 * Icon-only "apply this cell to all rows" control for DataTable columns.
 * Relies on an app-level TooltipProvider; do not nest a provider per cell.
 */
export function ApplyCellValueToAllButton({
  className,
  disabled = false,
  fieldLabel,
  onApply,
}: ApplyCellValueToAllButtonProps) {
  const tooltipText = `Apply ${fieldLabel} to all rows`;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label={tooltipText}
            className={cn("shrink-0 text-muted-foreground hover:text-foreground", className)}
            onClick={(event) => {
              event.stopPropagation();
              onApply();
            }}
          />
        }
      >
        <Layers aria-hidden="true" className="size-3.5" />
        <span className="sr-only">{tooltipText}</span>
      </TooltipTrigger>
      <TooltipContent side="top">{tooltipText}</TooltipContent>
    </Tooltip>
  );
}
