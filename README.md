# DealFlow360

This repository is prepared for a fast, Linear-driven Next.js development workflow. Product scope
and implementation decisions are approved through Linear and recorded as the codebase evolves.
Local planning drafts under `docs/product/` are intentionally not tracked.

## Toolchain

- Bun 1.4+
- Next.js App Router, React, Elysia, and Eden
- Better Auth email/password authentication
- Drizzle ORM with PostgreSQL/Postgres.js
- Resend and React Email
- shadcn/ui and Tailwind CSS
- Strict TypeScript
- Oxlint with repository-local rules and Oxfmt
- Bun test and Playwright

## Setup

```bash
bun install
# Copy .env.example to .env.local and fill development-only values.
bun run env:check
bun run dev:setup
bun run check:quick
```

Once an application entry exists:

```bash
bun run dev
bun run check
```

Use a separate `.env.test.local` based on `.env.test.example` before integration or Playwright tests.
Database names are guarded: local development must end in `_dev`, tests must end in `_test`.

Read `AGENTS.md` before contributing. Multi-device and Linear coordination lives in
`.agents/coordination.md`.
