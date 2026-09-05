# Testing

Tests are evidence for behavior, not a way to make a gate green.

- A bug fix SHOULD demonstrate a failing regression before the fix and a pass after it. If that is
  infeasible, state why.
- Use an independent oracle: observable UI, exact response, persisted state, error code, event, or
  documented invariant. Do not duplicate the production algorithm in the assertion.
- Cover applicable boundaries: empty/null, minimum/maximum, maximum-plus-one, malformed input,
  duplicate/retry, concurrency, partial failure, authorization, and cancellation.
- Never use arbitrary sleeps for synchronization. Await an observable condition and keep timeouts as
  kill switches only.
- Unit tests live under `test/unit/`; integration tests under `test/integration/`; browser specs under
  `playwright/e2e/`; shared browser helpers under `playwright/support/`.
- Regression is a purpose, not a separate layer. Keep `*.regression.test.ts` in the cheapest correct
  unit/integration layer and tag browser regressions `@regression`; `bun run test:regression` selects
  non-browser regression files.
- E2E tests SHOULD use real first-party paths and may mock third parties at the network boundary.
  Never mock the behavior the test claims to prove.
- Integration and E2E tests use a dedicated PostgreSQL database ending in `_test`, apply committed
  migrations, and run serially until per-worker database isolation exists.
- Better Auth flow tests exercise real signup/sign-in/logout without stored state. Other protected
  E2E specs MAY use the setup project's API-created storage state after the test DB is prepared.
- Do not mock Better Auth cookies/sessions, Elysia routing, Drizzle queries, PostgreSQL constraints,
  migrations, or first-party Next.js/API communication in integration/E2E tests. Mock Resend only at
  its provider boundary.
- Prefer accessible role/name selectors and exact user-facing labels over implementation selectors.
- Keep platform claims honest. A command run on Windows proves only that command and does not prove
  an unexercised device-specific product flow.

Iteration: run the smallest relevant test first. Handoff: run `bun run check`; use
`bun run check:full` for auth or critical browser-flow changes.
