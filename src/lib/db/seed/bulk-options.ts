import type { BulkSeedOptions } from "@/lib/db/_types/bulk-seed";

export function validateBulkOptions(options: BulkSeedOptions): BulkSeedOptions {
  if (!/^[a-z0-9][a-z0-9-]{0,23}$/.test(options.batch))
    throw new Error(
      "Batch must be 1–24 lowercase letters, digits or hyphens, starting with a letter or digit",
    );
  if (!Number.isInteger(options.count) || options.count < 1 || options.count > 200)
    throw new Error("Count must be an integer from 1 to 200 (default 100 linked scenarios)");
  const date = new Date(`${options.asOf}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(options.asOf) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== options.asOf
  )
    throw new Error("As-of date must be a valid YYYY-MM-DD calendar date");
  return options;
}

export function parseBulkOptions(args: string[], today = new Date().toISOString().slice(0, 10)) {
  const options: BulkSeedOptions = { batch: "review", count: 100, asOf: today };
  let dryRun = false;
  let help = false;
  const seen = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const key = args[i]!;
    if (key === "--") continue;
    if (seen.has(key)) throw new Error(`Repeated option ${key}`);
    seen.add(key);
    if (key === "--dry-run") dryRun = true;
    else if (key === "--help") help = true;
    else if (["--batch", "--count", "--as-of"].includes(key)) {
      const value = args[++i];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${key}`);
      if (key === "--batch") options.batch = value;
      if (key === "--as-of") options.asOf = value;
      if (key === "--count") {
        if (!/^\d+$/.test(value)) throw new Error("Count must be a positive integer");
        options.count = Number(value);
      }
    } else throw new Error(`Unknown option ${key}`);
  }
  return { ...validateBulkOptions(options), dryRun, help };
}

export function bulkSeedCounts(count: number) {
  return {
    customers: count,
    customerLogins: count,
    products: count * 2,
    quotations: count * 2,
    pendingApprovals: count,
    orders: count,
    subscriptions: count,
    invoices: count * 2,
    payments: count,
    credits: count,
    inventoryStockRows: count,
    reservations: count,
    messages: count * 2,
  };
}
