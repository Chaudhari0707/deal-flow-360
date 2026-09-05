# Integration Tests

- Use the dedicated `_test` PostgreSQL database and real committed migrations.
- Exercise real Elysia handlers, Better Auth endpoints, Drizzle queries, constraints, and transactions.
- Do not mock first-party layers. Mock Resend only at its adapter/network boundary.
- Integration regressions use `*.regression.test.ts` and remain in this directory.
