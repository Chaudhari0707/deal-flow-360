# Test Architecture

Use the cheapest layer that proves the behavior. Regression describes why a test is retained, not a
separate runtime.

| Layer | Location | Real boundaries | Command |
| --- | --- | --- | --- |
| Unit | `test/unit/` | Pure code only | `bun run test:unit` |
| Integration | `test/integration/` | Elysia, Better Auth, Drizzle, PostgreSQL | `bun run test:integration` |
| Regression | `*.regression.test.ts` in its unit/integration layer | Same as owning layer | `bun run test:regression` |
| Browser | `playwright/e2e/` | Browser through all first-party layers | `bun run test:e2e` |

## Database lifecycle

Integration and local E2E commands load `.env.test.local`, require `TEST_DATABASE_URL`, and reject a
database not ending in `_test`. Before tests they apply committed migrations, reset known tables, and
run deterministic seeders. Multiple devices must use separate test databases.

Unit tests never access PostgreSQL. Integration and browser tests do not mock Better Auth, Elysia,
Drizzle, PostgreSQL, migrations, or first-party HTTP. Resend is mocked at its provider boundary unless
a test is explicitly marked as live-provider verification.

## Better Auth and Playwright

Playwright uses one worker until per-worker database isolation exists. `auth.setup.ts` signs in through
the real Better Auth email/password endpoint and writes ignored storage state. Only
`*.authenticated.spec.ts` consumes that state. Login, logout, invalid-credential, verification, and
password-reset UI tests run without stored state.

The default browser suite uses `127.0.0.1`. The [loopback alias policy](local-runtime.md#loopback-aliases-and-sign-in)
also permits `localhost` with the same scheme and app port; alias tests must create their own real
session on that hostname rather than copying a cookie across hosts. Test foreign, missing, `null`,
and wrong-port mutation/WebSocket origins as denied cases. The local web server is considered ready
only when `/api/v1/health` responds.

## Regression proof

For a bug, first demonstrate the retained test fails against the defect when feasible. The test must
assert an independent observable and fail if the guarded behavior is removed or replaced by a no-op.
Use observable waits, never fixed sleeps.

## Gates

- `bun run check:quick`: formatting, lint, types, file size, instruction consistency.
- `bun run check`: quick gate, unit/regression/integration tests, production build.
- `bun run check:full`: complete gate plus Playwright.

Use the full gate for authentication and critical user journeys. Report exact skips and unverified
external delivery/device behavior.
