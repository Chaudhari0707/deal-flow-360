import type { ReactNode } from "react";

import { eyebrowType } from "@/components/editorial/editorial";
import { cn } from "@/lib/utils";

/**
 * DealFlow360 editorial design language — invoices pilot.
 *
 * Hierarchy comes from rules, spacing, alignment and type scale rather than cards, pills
 * and shadows. Keep these pieces local to the route until a second surface adopts them.
 */

/** Quiet, letterspaced label type. Labels always recede behind the value they describe. */

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn(eyebrowType, "text-muted-foreground", className)}>{children}</span>;
}

/** Label/value pair used in the masthead and the document meta strip. */
export function Meta({
  align = "start",
  label,
  value,
}: {
  align?: "end" | "start";
  label: string;
  value: ReactNode;
}) {
  return (
    <div className={cn(align === "end" && "sm:text-right")}>
      <dt className={cn(eyebrowType, "text-muted-foreground")}>{label}</dt>
      <dd className="mt-1.5 text-sm text-foreground tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * A summary figure in the ledger band. Data is the primary visual element: the value is
 * large and tabular, the label and note stay quiet.
 */
export function Figure({
  accent = false,
  label,
  note,
  value,
}: {
  accent?: boolean;
  label: string;
  note: string;
  value: ReactNode;
}) {
  return (
    <div className="py-7 sm:px-8 sm:first:pl-0 sm:last:pr-0">
      <span
        aria-hidden
        className={cn("mb-4 block h-0.5 w-7", accent ? "bg-ink-accent" : "bg-transparent")}
      />
      <dt className={cn(eyebrowType, "text-muted-foreground")}>{label}</dt>
      <dd className="mt-3 text-[1.75rem] leading-none font-medium tracking-tight text-foreground tabular-nums">
        {value}
      </dd>
      <p className="mt-3 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

/** Numbered section rule. The number carries the rhythm; the title stays quiet. */
export function SectionHead({
  children,
  index,
  title,
}: {
  children?: ReactNode;
  index: string;
  title: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-b border-foreground/30 pb-3">
      <h2 className={cn(eyebrowType, "flex items-baseline gap-3 text-muted-foreground")}>
        <span className="text-foreground tabular-nums">{index}</span>
        <span aria-hidden className="h-px w-6 self-center bg-foreground/25" />
        {title}
      </h2>
      {children ? (
        <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
          {children}
        </p>
      ) : null}
    </div>
  );
}

const markTone = {
  flag: "bg-ink-risk",
  open: "bg-foreground/40",
  settled: "bg-ink-positive",
} as const;

const textTone = {
  flag: "text-ink-risk",
  open: "text-muted-foreground",
  settled: "text-ink-positive",
} as const;

/** State as a compact marker plus text — never a coloured pill. */
export function StatusMark({ label, tone }: { label: string; tone: "flag" | "open" | "settled" }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span aria-hidden className={cn("size-1.5 shrink-0", markTone[tone])} />
      <span className={textTone[tone]}>{label}</span>
    </span>
  );
}

/** Editorial replacement for a boxed alert: a marker rule and plain text. */
export function Note({
  children,
  title,
  tone = "neutral",
}: {
  children: ReactNode;
  title?: string;
  tone?: "flag" | "neutral";
}) {
  return (
    <div
      role={tone === "flag" ? "alert" : "status"}
      className={cn("mt-8 border-l-2 pl-5", tone === "flag" ? "border-ink-risk" : "border-primary")}
    >
      {title ? (
        <p className={cn(eyebrowType, tone === "flag" ? "text-ink-risk" : "text-muted-foreground")}>
          {title}
        </p>
      ) : null}
      <p className={cn("text-sm text-foreground", title && "mt-1.5")}>{children}</p>
    </div>
  );
}

export { eyebrowType };
