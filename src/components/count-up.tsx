"use client";

import { useCallback, useEffect, useRef } from "react";
import { useInView, useMotionValue, useReducedMotion, useSpring } from "motion/react";

interface CountUpProps {
  className?: string;
  delay?: number;
  direction?: "down" | "up";
  duration?: number;
  /**
   * Render a frame's raw value as display text. Supply this for money: the built-in formatter is
   * plain en-US grouping with no currency, which cannot produce the en-IN INR figures used
   * everywhere else in this product.
   */
  format?: (value: number) => string;
  from?: number;
  onEnd?: () => void;
  onStart?: () => void;
  separator?: string;
  startWhen?: boolean;
  to: number;
}

/**
 * Counts a figure up when it scrolls into view.
 *
 * Two departures from the stock react-bits component, both load-bearing here:
 * the final value is rendered as real children so the server sends the number rather than an
 * empty span, and the animation is skipped entirely under `prefers-reduced-motion`.
 */
export default function CountUp({
  className = "",
  delay = 0,
  direction = "up",
  duration = 2,
  format,
  from = 0,
  onEnd,
  onStart,
  separator = "",
  startWhen = true,
  to,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(direction === "down" ? to : from);
  const damping = 20 + 40 * (1 / duration);
  const stiffness = 100 * (1 / duration);
  const springValue = useSpring(motionValue, { damping, stiffness });
  const isInView = useInView(ref, { once: true, margin: "0px" });

  const getDecimalPlaces = (value: number) => {
    const [, decimals] = value.toString().split(".");
    return decimals && Number.parseInt(decimals, 10) !== 0 ? decimals.length : 0;
  };
  const maxDecimals = Math.max(getDecimalPlaces(from), getDecimalPlaces(to));

  const formatValue = useCallback(
    (latest: number) => {
      if (format) return format(latest);
      const hasDecimals = maxDecimals > 0;
      const formatted = Intl.NumberFormat("en-US", {
        maximumFractionDigits: hasDecimals ? maxDecimals : 0,
        minimumFractionDigits: hasDecimals ? maxDecimals : 0,
        useGrouping: Boolean(separator),
      }).format(latest);
      return separator ? formatted.replaceAll(",", separator) : formatted;
    },
    [format, maxDecimals, separator],
  );

  const settled = formatValue(direction === "down" ? from : to);

  useEffect(() => {
    if (reduceMotion || !isInView || !startWhen) return;
    if (ref.current) ref.current.textContent = formatValue(direction === "down" ? to : from);
    onStart?.();
    const start = setTimeout(() => {
      motionValue.set(direction === "down" ? from : to);
    }, delay * 1000);
    const end = setTimeout(() => onEnd?.(), delay * 1000 + duration * 1000);
    return () => {
      clearTimeout(start);
      clearTimeout(end);
    };
  }, [
    delay,
    direction,
    duration,
    formatValue,
    from,
    isInView,
    motionValue,
    onEnd,
    onStart,
    reduceMotion,
    startWhen,
    to,
  ]);

  useEffect(() => {
    if (reduceMotion) return;
    return springValue.on("change", (latest: number) => {
      if (ref.current) ref.current.textContent = formatValue(latest);
    });
  }, [formatValue, reduceMotion, springValue]);

  return (
    <span className={className} ref={ref}>
      {settled}
    </span>
  );
}
