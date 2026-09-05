# Running the local workspace

The application runs locally at `http://127.0.0.1:3000`. Its authenticated stock feed runs on port
3101. PostgreSQL is configured through the ignored `.env.local`; it is an independently managed
process. The application launcher never stops, resets, or starts an unrelated database.

After installing dependencies and configuring the sanitized environment contract, start the configured
PostgreSQL database and run `bun run dev:setup` to validate configuration, apply committed migrations,
and seed the local demo. Then run `bun scripts/dev-local.ts` to launch both Next.js and the stock feed.
`bun scripts/dev-local.ts --check` validates the local origin, matching ports, database connectivity,
and the presence of the migrated order schema without starting application servers.

The launcher uses the Bun runtime and the installed Next.js Webpack development mode. Webpack avoids
the dependency-resolution failure observed with this workspace's ExcelJS dependency under Turbopack.
Both processes use the same environment and database. The launcher rejects occupied ports instead of
choosing another port or stopping an existing listener. Ctrl+C or SIGTERM stops both application
processes. If either child exits unexpectedly, the other is stopped and the launcher returns failure.
The graceful shutdown window is five seconds, followed by forced termination of only its own children.

Use the canonical `127.0.0.1` host consistently. Better Auth cookies, the allowed WebSocket origin,
and the local content security policy use that host. `REALTIME_PORT`, when specified, must be 101
higher than the app port: 3101 for development, 3102 for browser acceptance.

## Browser acceptance

`bun run test:e2e` validates the dedicated `_test` database target, migrates and resets that test
database, and creates the canonical demo seed. It sets the provider-boundary test email transport so
browser acceptance does not send real email. Playwright starts and waits for two services:

| Service | Address | Isolation |
| --- | --- | --- |
| Next.js with Webpack | `http://127.0.0.1:3001` | `NEXT_DIST_DIR=.next-test` and dedicated test database |
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
