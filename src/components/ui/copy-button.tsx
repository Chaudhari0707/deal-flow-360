"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CopyButton({
  className,
  value,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onClick" | "size" | "variant"> & {
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      className={cn("shrink-0 text-muted-foreground", className)}
      onClick={async (event) => {
        event.stopPropagation();
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1_500);
      }}
      {...props}
    >
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
    </Button>
  );
}
