# Database

- PostgreSQL, Postgres.js, Drizzle ORM, and Drizzle Kit are selected. Domain schema layout, IDs,
  tenancy, retention, and deletion policy still require an explicit maintainer or Linear decision.
- Once selected, match existing migration and query patterns exactly; do not create a parallel data
  access style.
- Enforce durable integrity with database constraints where supported, not application checks alone.
- Make live-table migrations additive and backward-compatible first; backfill before tightening.
- Review indexes against actual new query patterns. Do not add speculative indexes.
- Every migration needs an explicit rollback or a documented reason rollback is unsafe/impossible.
- Generate reviewable SQL under `drizzle/`, commit SQL and metadata, and migrate before application
  startup. Never edit a migration already applied to a shared database.
- Never use schema push as a substitute for a reviewable migration on shared environments.
- Tests must cover constraints, transaction rollback, duplicate/concurrent writes, and relevant
  authorization/tenant boundaries.
