# Local delivery verification

Verified on 2026-09-05 on macOS arm64. Final execution used Bun 1.4.2, Next.js 16.3.3,
PostgreSQL 18 and Playwright Chromium. The earlier first-cold-request compatibility check also ran
successfully on Bun 1.4.0. Nothing was hosted or deployed externally.

## Configured checks

`bun run check:full` passed against the integrated code, including loopback-origin compatibility:

| Check | Result |
| --- | --- |
| Formatting, Oxlint, strict TypeScript, file-size and instruction checks | Passed |
| Unit tests | 52 passed |
| Regression selection | 71 passed |
| PostgreSQL integration tests | 42 passed |
| Native Turbopack production build | Passed |
| Playwright authentication setup and browser checks | 11 passed |

Regression is a purpose across unit/integration layers, so those 71 selections overlap the other
counts; they are not an additional 71 unique tests. Browser scenarios cover credentials, mobile
navigation, catalog configuration, customer negotiation, the HIGH approval journey, inventory
restock/consolidation/shipment, billing/documents and compiled styles.

Loopback compatibility coverage verifies same-scheme, same-port `localhost` / `127.0.0.1`
origins with separate host-scoped sign-ins. The alias browser scenario passed real login, an actual
customer mutation, live stock and logout; foreign and wrong-port sign-in attempts returned 403.
Unit and real HTTP/WebSocket integration checks also cover missing, `null` and unrelated origins,
plus malformed configured URLs. The complete 11-check browser run passed in 51 seconds without retries.

The HIGH journey verifies ₹26,805.24 one-time plus ₹46 recurring, one subscription and 22 Main / 2 East
reservations. Real database tests include simultaneous operations, rollback, role/customer isolation,
zero-balance invoices, rational price bases, actual-day proration, scheduler restarts and email retries.

The framework emits a development prefetch diagnostic when an unauthenticated protected route
redirects to login. The real login/logout/redirect assertions pass; this is distinct from a failed
application request or browser assertion.

## Local runtime and documents

- `bun run dev:setup` and `bun run local:check` passed with the isolated local PostgreSQL cluster.
- Native Bun/Turbopack first-cold-request checks passed for API readiness, real authentication,
  workspace data, compiled `postcss.config.ts` styles and PDF/XLSX generation. No MJS bridge remains.
- A separate local **production-mode** server (`next start`, production environment) passed real
  authentication, workspace, stylesheet, invoice PDF, report PDF and XLSX checks. It was stopped
  after verification; this was not a hosted deployment.
- A real Resend development send was accepted using the supported test sink. Provider acceptance
  does not prove a person's inbox delivery. Normal suites use a provider-boundary simulation.
- The active local application and stock/billing companion return healthy responses on ports 3000
  and 3101. The companion reports successful automatic billing runs.

## Measured read workload

`bun scripts/local-load.ts` measured one authenticated session against the seeded local workspace,
inventory and fulfillment APIs, with at most 10 requests in flight:

| Phase | Requests | Achieved rate | p95 full-response latency | Errors / skipped |
| --- | --- | --- | --- | --- |
| Sustained, 60 seconds | 300 | 5 requests/second | 10.26 ms | 0 / 0 |
| Burst, 10 seconds | 200 | 20 requests/second | 9.14 ms | 0 / 0 |

All 500 requests returned HTTP 200, and the measurement session was signed out. This is a small
local read benchmark, not a multi-user write benchmark or production-capacity promise. Concurrent
write integrity has separate integration coverage. Raw measurements stay in ignored local artifacts.

## Dependency audit follow-up

`bun audit --json` returned two **moderate** transitive advisories and therefore did not return a
clean audit result. The configured application/test gates above still passed.

| Dependency path | Advisory and current assessment |
| --- | --- |
| Drizzle Kit → legacy esbuild-kit loader → esbuild 0.18.20 | The [esbuild advisory](https://github.com/advisories/GHSA-67mh-4wv8-2f99) concerns its HTTP serve feature. This application serves through Next.js Turbopack; the inspected loader uses transforms. |
| ExcelJS 4.4.0 → uuid 8.3.2 | The [uuid advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq) concerns v3/v5/v6 with supplied buffers. The inspected ExcelJS call site imports v4; application IDs use `crypto.randomUUID()`. |

Those affected paths were not found in the exercised workflows. This is a scoped reachability
assessment, not a guarantee about every dependency capability. Follow-up DF-14 is parked for supported
upstream updates or compatibility-tested overrides; no unsupported major override was forced.

## Explicit limits

Only the exercised macOS/Chromium/local PostgreSQL setup is verified. Other operating systems,
mobile devices beyond the tested viewport, human inbox delivery, external payment networks, hosted
availability and production backup/recovery objectives remain unverified or out of this release.
The documented business limits include one selling organization, INR, three active warehouses,
same-cadence subscription changes and no cross-invoice credit application or cash refund.
