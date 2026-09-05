# End-to-End Tests

- Exercise browser → Next.js → Elysia/Better Auth → PostgreSQL through real first-party paths.
- Use `*.authenticated.spec.ts` only for tests that may start from saved Better Auth state.
- Authentication-flow specs MUST use no stored state and prove the real login/logout/error UI.
- Tag retained bug coverage with `@regression`; do not use retries to hide flakes.
- Keep one worker until database-per-worker isolation is implemented.
