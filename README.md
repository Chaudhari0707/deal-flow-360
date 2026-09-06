# DealFlow360

Read the [complete project flow guide](docs/flows/README.md) for every role's journey,
worked examples, flow diagrams, permissions, failure paths and test coverage.

A local sales-operations application that connects governed quotations, customer negotiation,
warehouse fulfillment, recurring billing and payment reconciliation. The interface uses shadcn's
dashboard block composition with tweakcn's Supabase theme.

Start with the [five-minute demo](docs/demo.md), [architecture guide](docs/architecture/README.md),
or [local runtime guide](docs/engineering/local-runtime.md).

## Toolchain

- Bun 1.4+
- Next.js App Router, React, Elysia, and Eden
- Better Auth email/password authentication
- Drizzle ORM with PostgreSQL/Postgres.js
- Resend and React Email
- shadcn/ui and Tailwind CSS
- TanStack Table v9 and SWR for reusable client data surfaces
- Strict TypeScript
- Oxlint with repository-local rules and Oxfmt
- Bun test and Playwright

## Setup

```bash
bun install
# Copy .env.example to .env.local and fill development-only values.
bun run env:check
bun run dev:setup
bun run local
```

Open **http://127.0.0.1:3000**. The launcher starts the app and authenticated stock feed together;
Ctrl+C stops both. PostgreSQL stays running independently.

The development database must already exist and match `DATABASE_URL`. This workspace's prepared
local cluster uses port 55432, database `deal_flow_360_dev` and a separate `deal_flow_360_test`; its
private credentials live only in ignored environment files. Other machines may use their own local
PostgreSQL installation. Apply migrations before seeding; do not substitute schema push.

Set `DEMO_PASSWORD` to opt into the full synthetic demo seed; these accounts share that local password:

| Role | Demo email |
| --- | --- |
| Sales Rep | `rep@dealflow360.demo` |
| Sales Manager | `manager@dealflow360.demo` |
| Finance | `finance@dealflow360.demo` |
| Operations | `ops@dealflow360.demo` |
| Admin | `admin@dealflow360.demo` |
| Acme customer | `acme@dealflow360.demo` |

Customer access is separate from the internal workspace. New self-signups become Sales Reps,
not administrators. Demo accounts are synthetic; no production credentials are included.

For larger datasets, run `bun run db:seed:bulk --dry-run`, then `bun run db:seed:bulk` to add
100 linked sample scenarios without resetting existing data. Rerun the same batch safely, or use
`--batch review-2` to add another. See [bulk seeding](docs/engineering/bulk-seeding.md) for counts,
customer logins, date controls, and the reusable function.

## Verification

```bash
bun run check:quick     # formatting, lint, types, file size and instructions
bun run check          # plus unit, regression, PostgreSQL integration and production build
bun run check:full     # plus real Chromium journeys against a reset test database
```

Use a separate `.env.test.local` based on `.env.test.example` before integration or Playwright tests.
Database names are guarded: local development must end in `_dev`, tests must end in `_test`.

`bun run check:full` requires the installed Playwright Chromium binary (`bun run test:e2e:install`).
Tests simulate Resend only at its provider boundary; live delivery is a separate explicit check.
The local companion checks due recurring periods on startup and every minute; invoice uniqueness
preserves retry safety after a restart. Automated tests explicitly disable that clock-driven worker.
`EMAIL_TEST_RECIPIENT=delivered@resend.dev` directs local mail to Resend's supported test sink.
Leave that override out only when the actual sender/recipient configuration is ready.

## Boundaries

This release runs locally with INR, one selling organization, three active warehouses, manual
full-balance payments and credit notes. Same-cadence subscription changes are supported; cash refunds,
cross-cadence conversion, cross-invoice credit application, multi-company and external payment rails
are documented follow-ups. Large workspace summaries are bounded; production capacity is not claimed.

Feature branches merge through `dev`, then `prod` (the production branch), then `main` after the verification gates.
These are repository branches, not hosted deployments. Phase ownership and Linear references are in
[delivery work](docs/engineering/delivery-work.md).

Read `AGENTS.md` before contributing. Multi-device and Linear coordination lives in
`.agents/coordination.md`.
