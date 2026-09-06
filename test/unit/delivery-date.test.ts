import { expect, test } from "bun:test";

import {
  currentCalendarDate,
  isCurrentOrFutureCalendarDate,
} from "@/features/quotes/delivery-date";

const now = new Date("2026-09-06T12:00:00.000Z");

test("delivery dates accept today and future calendar dates while rejecting past or invalid values", () => {
  expect(currentCalendarDate(now)).toBe("2026-09-06");
  expect(isCurrentOrFutureCalendarDate("2026-09-06", now)).toBe(true);
  expect(isCurrentOrFutureCalendarDate("2026-09-07", now)).toBe(true);
  expect(isCurrentOrFutureCalendarDate("2026-09-05", now)).toBe(false);
  expect(isCurrentOrFutureCalendarDate("2026-02-30", now)).toBe(false);
  expect(isCurrentOrFutureCalendarDate("06-09-2026", now)).toBe(false);
});
