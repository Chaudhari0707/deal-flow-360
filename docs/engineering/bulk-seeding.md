# Repeatable local sample data

Use the bulk seeder for manual review, pagination, filters, and report testing. This is a
developer CLI, not an admin HTTP endpoint. It accepts only a local development database whose
name ends in `_dev`, and refuses `NODE_ENV=production`. It never resets tables, changes existing
records, migrates schema, sends email, or creates magic links.

## Run it

Prerequisites: apply committed migrations with `bun run db:migrate`, configure `DEMO_PASSWORD`
(at least 12 characters) in the ignored `.env.local`, and run `bun run db:seed` once to create
the standard demo role accounts. Keep the existing database; do not run reset to add samples.

```sh
# Inspect the target and maximum new-record counts without opening the database.
bun run db:seed:bulk --dry-run

# Add the default batch: 100 linked scenarios.
bun run db:seed:bulk

# Same name safely skips completed scenarios, including ones edited through the UI.
bun run db:seed:bulk --batch review --count 100

# Extend that batch to 150 scenarios (adds only the missing 50).
bun run db:seed:bulk --batch review --count 150

# Add a separate batch whenever more data is needed.
bun run db:seed:bulk --batch review-2 --count 100

# Fix the calendar anchor for reproducible historical report fixtures.
bun run db:seed:bulk --batch august --count 100 --as-of 2026-08-31
```

`--count` accepts 1–200 **scenarios**, not a cap on each database table. Default is 100, chosen
so each major record-based screen gets 100–200 samples. Each batch creates up to three shared
sample warehouses. Settings, dashboard, reports and health are configuration/derived views, not
independent tables that need 100 fake settings or reports. Existing data is additional to these counts.

| Records added by a fresh default batch | Count |
| --- | ---: |
| Customers and linked customer logins | 100 each |
| Products (hardware and recurring care plans) | 200 |
| Quotations (100 confirmed, 100 pending approval) | 200 |
| Orders / fulfillment records | 100 |
| Subscriptions | 100 |
| Invoices (one-time and recurring) | 200 |
| Payment entries and credit notes | 100 each |
| Inventory stock rows and reservations | 100 each |
| Quotation messages | 200 |

Audit events, revisions and stock movements are additional supporting records. A `--count 200`
batch doubles the table above: products, quotations and invoices will each get 400 records.
The output distinguishes newly added scenarios from skipped ones; dry-run is an upper-bound plan,
not a database count of existing scenarios.

Current UI limitation: the shared workspace query caps several lists at 200 records (and the
activity feed at 100). Existing records plus this batch can exceed those limits. Records remain
in PostgreSQL, but client-side table pagination/search cannot reveal rows omitted by that API.
This command does not change those limits or implement server-side pagination; do not use the
workspace/dashboard snapshot as an exhaustive count of a large database.

## Review the data

- Open Customers or Product catalog as admin/manager and search `Sample review` (or your batch).
- Use the existing `rep@dealflow360.demo` account for the generated quotes. Managers handle the
  pending manager-step approvals, with both medium- and high-risk examples.
- Operations sees ready, backordered, split-pending and fulfilled orders. Stock reservations and
  shipment movements match the generated balances; samples have their own products/warehouses.
- Finance sees paid, partially paid and unpaid invoices, payments, applied credits and monthly,
  quarterly and annual subscriptions. Recent and older dates support overdue/report examples.
- A sample customer signs in as `bulk-review-0001@example.test`, using the local `DEMO_PASSWORD`.
  These are synthetic ready-to-use portal accounts, not real onboarding invitations: no email is
  sent and no temporary-password-change gate is set. Each login is linked only to its own customer.
- Reports and dashboard totals are computed from the linked commercial records. Pricing uses the
  existing default tier/discount rules and billing uses `createOrderBilling`; monetary figures are
  synthetic INR amounts, not exchange-rate conversions. No live currency API is called.

The default calendar anchor is today's UTC date; creation dates span the preceding 60 days.
An existing scenario keeps its original dates and values on rerun, even if `--as-of` changes.
Use a new batch for a different calendar scenario. The local recurring-billing worker may generate
additional invoices for overdue subscription periods after seeding; that is normal application
behavior, not a duplicate seed.

## Retry and safety

Stable batch/index identifiers and completion audit markers prevent duplicates. An advisory lock
serializes simultaneous calls for the same batch. Customer identities are created through Better
Auth within the same transaction as all commercial records. A conflict or failure rolls back the
entire invocation, preserving existing data. Use the same batch to retry after resolving the cause;
use a different name if a non-seed record already owns one of the sample identifiers/emails.

Decreasing `--count` does not remove samples. Changing `DEMO_PASSWORD` does not reset already seeded
accounts' passwords. This command intentionally has no bulk-delete or cleanup mode.

Reusable function: [`seedBulkData(database, options)`](../../src/lib/db/seed/bulk.ts).
CLI: [`db-seed-bulk.ts`](../../scripts/db-seed-bulk.ts).
Coverage: [argument tests](../../test/unit/bulk-seed.test.ts) and
[database consistency, retry and rollback tests](../../test/integration/bulk-seed.test.ts).
