# Running the local workspace

The application runs locally at `http://127.0.0.1:3000`. Its authenticated stock feed runs on port
3101. PostgreSQL is configured through the ignored `.env.local`; it is an independently managed
process. The application launcher never stops, resets, or starts an unrelated database.

After installing dependencies and configuring the sanitized environment contract, start the configured
PostgreSQL database and run `bun run dev:setup` to validate configuration, apply committed migrations,
and seed the local demo. Then run `bun run local` to launch both Next.js and the stock feed.
`bun run local:check` validates the local origin, matching ports, database connectivity,
and the presence of the migrated order and invoice-delivery schema without starting
application servers. Customer confirmation queues invoice email in the same transaction, so
a database that still lacks `invoice_deliveries` (migration `0004`+) returns HTTP 500 and
rolls the order back. Run `bun run db:migrate` or `bun run dev:setup` before confirming.

The launcher uses Bun and native Next.js Turbopack with `postcss.config.ts`. The supported package
bundling configuration avoids Bun's cold external-alias resolution issue; see the
[runtime decision](../architecture/runtime.md). There is no PostCSS JavaScript compatibility file.
Both processes use the same environment and database. The launcher rejects occupied ports instead of
choosing another port or stopping an existing listener. Ctrl+C or SIGTERM stops both application
processes. If either child exits unexpectedly, the other is stopped and the launcher returns failure.
The graceful shutdown window is five seconds, followed by forced termination of only its own children.

The local companion enables automatic billing by default. It checks due subscription periods on
startup and every minute, using the same transactional rules as Finance's manual due run. A restart
discovers unfinished periods from PostgreSQL; invoice identities prevent duplicate charges. Its
health response reports whether billing is enabled, the last run/success time and failure state.
Tests set `AUTOMATIC_BILLING=false` except the dedicated restart regression.

## Loopback aliases and sign-in

`BETTER_AUTH_URL` remains the canonical URL used by authentication and generated email links.
For a configured `http://127.0.0.1:3000`, the application also accepts `http://localhost:3000`;
configuring `localhost` permits the reverse alias. Scheme and port must match. No wildcard, other
hostname, different port, `null` origin or missing mutation Origin is permitted. A non-loopback
configured URL receives no additional hostname alias.

Better Auth and protected API mutations use the same `trustedOrigins` policy. The authenticated
WebSocket upgrade and its CSP allowance follow that loopback pair. Origin permission does not merge
browser cookie stores: a session created on `127.0.0.1` is not a session on `localhost`. Stay on one
hostname within a browser session, or sign in again after switching. The stock feed uses the current
page hostname so it receives that host's cookie.

`REALTIME_PORT`, when specified, must be 101 higher than the app port: 3101 for development,
3102 for browser acceptance. Both alias origins refer to the same local application/database;
this does not enable remote hosting or cross-port authentication.

## Browser acceptance

`bun run test:e2e` validates the dedicated `_test` database target, migrates and resets that test
database, and creates the canonical demo seed. It sets the provider-boundary test email transport so
browser acceptance does not send real email. Playwright starts and waits for two services:

| Service | Address | Isolation |
| --- | --- | --- |
| Next.js with native Turbopack | `http://127.0.0.1:3001` | `NEXT_DIST_DIR=.next-test` and dedicated test database |
| Authenticated stock feed | `http://127.0.0.1:3102` | Same test database and auth origin as Next.js |

Both services have explicit readiness URLs and graceful termination on completion or test failure.
The test server output directory is separate from local development/build output. Reusing a server
requires the explicit `PLAYWRIGHT_REUSE_SERVER=true` setting; otherwise an occupied test port fails
instead of silently testing an unrelated process.

For focused iteration against an already prepared local server, set `PLAYWRIGHT_BASE_URL` explicitly.
In that mode the runner does not reset the database or manage either process. The operator owns the
server and matching stock feed. Full acceptance must run against a fresh canonical seed because some
browser scenarios deliberately fulfill or settle seeded orders.

Verified behavior is limited to the exercised local macOS/Bun environment. Cross-platform graceful
process handling remains a separate verification task; no hosted deployment is configured.

## Small local workload measurement

With the configured local application already running, `bun scripts/local-load.ts` authenticates a
demo account, warms three bounded read endpoints, measures 60 seconds at 5 requests/second and a
10-second burst at 20 requests/second, then signs out that measurement session. Credentials come from
ignored `LOAD_TEST_EMAIL`/`LOAD_TEST_PASSWORD` settings or the demo defaults; they are never logged or
written to the report. The default concurrency limit is 10, with a maximum configurable limit of 20.

The JSON artifact at `.local/local-load-report.json` records requested and achieved rates, elapsed
time, HTTP/transport errors, skipped launch slots, and full-response p50/p95/max latency. The script
returns failure when requests fail or the requested schedule exceeds its concurrency budget. Options
shown by `bun scripts/local-load.ts --help` allow a shorter run or a different local origin. Targets
must remain loopback HTTP addresses. This measurement covers one authenticated session reading the
seeded workspace; write contention and multi-user behavior have separate integration tests.
