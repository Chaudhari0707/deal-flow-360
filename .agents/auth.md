# Better Auth Credentials

- Authentication is Better Auth email/password only. Do not add social providers, OAuth credentials,
  magic-link login, or account linking unless explicitly approved later.
- Mount Better Auth exactly once at `/api/auth/[...all]` and return its response/cookies unchanged.
- Use the Drizzle PostgreSQL adapter with the complete canonical schema object. Better Auth CLI may
  generate schema; Drizzle Kit alone owns migration generation/execution.
- Use the pinned `auth` CLI matching the Better Auth runtime. The legacy `@better-auth/cli` generator
  omits required modern account identity fields; credential integration must verify the migration.
- Credential forms use `method="post"` and wait for hydration before client submission, so a native
  fallback cannot put passwords in a GET URL.
- Keep `BETTER_AUTH_SECRET` server-only and at least 32 bytes. `BETTER_AUTH_URL` selects the canonical
  origin. Only its same-scheme, same-port `localhost`/`127.0.0.1` alias is additionally trusted;
  reuse `trustedOrigins` for HTTP and WebSocket origin checks. Missing/foreign mutation origins are
  rejected. Cookies remain host-scoped, so changing aliases requires a separate sign-in.
- Protected server actions and Elysia handlers validate the session server-side. Hiding UI is never
  authorization.
- Portal identity resolves the Better Auth session first. Any signed-in non-customer role is `403`
  on `/portal` and `/api/v1/portal/*`, even when a leftover `dealflow_portal` cookie is still valid.
  Staff reply on quotation detail; they never use the customer shell.
- Open signup, email verification, reset callbacks, session duration/revocation, roles, and account
  lifecycle remain explicit Linear decisions.
- Auth-flow E2E tests use real credentials and no saved state. Other E2E specs may reuse ignored
  Playwright storage state created after test DB reset/migration/seed.
