"use client";

import CountUp from "@/components/count-up";
import { money } from "@/lib/money";

/**
 * A figure that counts up when it scrolls into view.
 *
 * Money is formatted through the shared `money` helper on every frame, so the animation keeps the
 * INR symbol and en-IN grouping the rest of the product uses rather than falling back to the
 * component's plain en-US formatting.
 */
export function CountValue({
  className,
  currency = false,
  value,
}: {
  className?: string;
  currency?: boolean;
  value: number;
}) {
  return (
    <CountUp
      className={className}
      duration={0.9}
      format={currency ? money : undefined}
      separator=","
      to={value}
    />
  );
}
