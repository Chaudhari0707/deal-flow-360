# Tooling

The repository uses Bun as package manager and runtime. `package.json` is the command source of truth.

| Command | Purpose |
| --- | --- |
| `bun run env:check` | Validate core local environment without printing secrets |
| `bun run dev:setup` | Validate, migrate, and seed a guarded local `_dev` database |
| `bun run dev` | Start Next.js development server |
| `bun run clean` | Remove generated artifacts only |
| `bun run clean:all` | Explicitly remove generated artifacts and dependencies |
| `bun run fmt` | Format supported source/config files |
| `bun run lint` | Build and run Oxlint plus local rules |
| `bun run typecheck` | Strict TypeScript check |
| `bun run file-size` | Enforce the 500-line source limit |
| `bun run check:instructions` | Validate instruction files and budgets |
| `bun run test:unit` | Run Bun unit tests when present |
| `bun run test:regression` | Select retained regressions in their unit/integration layer |
| `bun run test:integration` | Run real Elysia/Better Auth/Drizzle/PostgreSQL tests |
| `bun run test:e2e` | Run Playwright browser tests |
| `bun run check` | Complete available handoff gate |
| `bun run check:full` | Full gate plus Playwright |
| `bun run db:generate` | Generate reviewable Drizzle SQL migrations |
| `bun run db:migrate` | Apply committed migrations |
| `bun run db:seed` | Apply deterministic local development seeders |
| `bun run db:seed:bulk --dry-run` | Preview additive sample data; omit `--dry-run` to apply a named batch ([guide](bulk-seeding.md)) |
| `bun run db:reset -- --force` | Reset and optionally seed a guarded local `_dev` database |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run auth:generate` | Generate Better Auth schema and normalize generated lint |
| `bun run email:dev` | Preview React Email templates |

Oxfmt currently excludes Markdown and CSS because its Bun worker path is not reliable across the
supported Windows setup. EditorConfig still normalizes those files. Re-enable them only after the
Windows command is exercised successfully.
