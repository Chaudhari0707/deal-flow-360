# Better Auth Credentials

- Authentication is Better Auth email/password only. Do not add social providers, OAuth credentials,
  magic-link login, or account linking unless explicitly approved later.
- Mount Better Auth exactly once at `/api/auth/[...all]` and return its response/cookies unchanged.
- Use the Drizzle PostgreSQL adapter with the complete canonical schema object. Better Auth CLI may
  generate schema; Drizzle Kit alone owns migration generation/execution.
- Keep `BETTER_AUTH_SECRET` server-only and at least 32 bytes. `BETTER_AUTH_URL`, trusted origins,
  Playwright base URL, and cookie host must use the same canonical origin.
- Protected server actions and Elysia handlers validate the session server-side. Hiding UI is never
  authorization.
- Open signup, email verification, reset callbacks, session duration/revocation, roles, and account
  lifecycle remain explicit Linear decisions.
- Auth-flow E2E tests use real credentials and no saved state. Other E2E specs may reuse ignored
  Playwright storage state created after test DB reset/migration/seed.
