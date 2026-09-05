# Seeding and Reset

- Seed data is synthetic, deterministic, idempotent, and transactionally applied.
- Separate stable reference seeders from optional demo scenarios when domain data is introduced.
- Use fixed non-production identifiers and conflict-aware writes. Do not use real customer data,
  copied credentials, or production-like secrets.
- Create credential users through Better Auth APIs; never hand-roll or insert password hashes.
- Seed scripts do not create schema or run migrations. The order is migrate, reset if requested, seed.
- `db:reset` and `db:push` require explicit force, print only host/port/database, reject system DBs,
  and are limited to local databases ending `_dev`. Test commands require a database ending `_test`.
- Multiple devices use separate local/test databases. Never automatically reset a shared remote DB.
