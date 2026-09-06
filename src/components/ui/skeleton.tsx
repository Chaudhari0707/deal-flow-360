import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-none bg-foreground/12 dark:bg-foreground/15", className)}
      {...props}
    />
  );
}

export { Skeleton };
