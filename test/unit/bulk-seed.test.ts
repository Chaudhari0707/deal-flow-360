import { expect, test } from "bun:test";

import { bulkSeedCounts, parseBulkOptions, validateBulkOptions } from "@/lib/db/seed/bulk-options";

test("bulk seed defaults and explicit arguments are bounded and reproducible", () => {
  expect(parseBulkOptions([], "2026-09-06")).toEqual({
    batch: "review",
    count: 100,
    asOf: "2026-09-06",
    dryRun: false,
    help: false,
  });
  expect(
    parseBulkOptions([
      "--",
      "--count",
      "200",
      "--batch",
      "review-2",
      "--as-of",
      "2026-08-01",
      "--dry-run",
    ]).count,
  ).toBe(200);
  expect(parseBulkOptions(["--help"]).help).toBe(true);
  expect(bulkSeedCounts(100)).toMatchObject({
    customers: 100,
    products: 200,
    quotations: 200,
    orders: 100,
    pendingApprovals: 100,
    subscriptions: 100,
    invoices: 200,
  });
  expect(bulkSeedCounts(0).invoices).toBe(0);
  expect(validateBulkOptions({ batch: "a", count: 1, asOf: "2024-02-29" }).count).toBe(1);
});

test("bulk seed rejects malformed, duplicate, excessive and unsafe arguments", () => {
  for (const args of [
    ["--count", "0"],
    ["--count", "201"],
    ["--count", "1.5"],
    ["--count", "NaN"],
    ["--count", "1e2"],
    ["--count"],
    ["--batch", "../outside"],
    ["--batch", "wild%"],
    ["--batch", "x".repeat(25)],
    ["--as-of", "2026-02-30"],
    ["--as-of", "invalid"],
    ["--count", "1", "--count", "2"],
    ["--reset"],
    ["--dry-run", "--dry-run"],
  ])
    expect(() => parseBulkOptions(args)).toThrow();
});
