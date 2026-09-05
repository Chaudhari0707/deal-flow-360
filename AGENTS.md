# Repository Working Agreement

Read `.agents/index.md` and load only the playbooks relevant to the current task.

The words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY use their RFC 2119 meanings. Keep
instructions as concise Markdown. Put universal rules here and situational detail in `.agents/`.

## Source of truth

- An explicit maintainer request or approved Linear task may select technology and architecture.
- When work has a Linear issue, its approved scope, acceptance criteria, decisions, and latest
  maintainer comments are the task contract. Read them before editing.
- Local planning drafts under `docs/product/` are product input, not approved technical architecture.
  Do not infer database shape, module boundaries, deployment, or ownership from them.
- Planning drafts alone cannot select technology or architecture. Explicit maintainer choices and
  approved Linear decisions become binding when reflected in repository code or docs.
- If no Linear issue exists, use the user's request as scope and ask only when an unresolved choice
  would materially change the result.

## Working rules

- Inspect the current tree, nearby instructions, and existing patterns before changing code.
- Preserve unrelated and pre-existing work. Never discard another contributor's changes.
- Solve the requested problem at its root; do not perform speculative refactors or add unrequested
  architecture.
- Prefer the smallest complete change. Reuse an established pattern before creating a new one.
- Validate external input at the boundary and enforce authorization on the server.
- Never commit secrets, tokens, production data, private Linear exports, or `.env*` files other than
  sanitized `*.example` contracts.
- A real bug that reveals a reusable trap SHOULD add one concise lesson to
  `.agents/learnings.md` or the nearest routed playbook in the same task. Do not record one-off
  history.

## Toolchain

- Bun is the package manager and JavaScript runtime. Use `bun` and `bunx`; do not mix lockfiles.
- This repository targets strict TypeScript, React, Next.js App Router, Elysia, Better Auth
  credentials, Drizzle/PostgreSQL, Resend, shadcn/ui, Oxlint, Oxfmt, Bun test, and Playwright. Read
  the routed playbook for every touched surface.
- Use `@/` imports across `src/` directories. Parent-relative imports inside `src/` are lint errors.
- Run focused checks while iterating. Before a completed handoff, run `bun run check` when the app
  is buildable; otherwise run `bun run check:quick` and report exactly why build/tests were skipped.
- Never weaken or bypass a check to make a failing change appear green.

## Architecture discipline

- Do not create domain layers, services, repositories, schemas, queues, caches, or abstractions
  before the task contract requires them.
- Once an architectural decision is approved, document the durable decision under
  `docs/architecture/` and update the nearest instruction owner in the same change.
- Keep framework entry files focused on routing and composition; move substantial logic into named,
  testable modules only when that boundary is supported by the task and codebase.
- New or changed API contracts, database schemas, permissions, or cross-layer flows require tests
  and matching documentation in the same task.
- Every user-facing flow change MUST update its guide and coverage index under `docs/flows/` in
  the same task. Follow `.agents/docs.md` for diagrams, examples, and verification evidence.

## Coordination and git

- For multi-device or parallel work, follow `.agents/coordination.md`. One Linear issue owns one
  branch/worktree unless the issue explicitly records a different split.
- Branch names use `agent/<linear-id>-<slug>` when an issue exists, otherwise
  `agent/<short-scope>`. Never put machine names or personal data in branch names.
- Do not run `git add`, `git commit`, `git push`, merge, or change Linear state unless the user asks.
- Destructive git/filesystem actions require explicit approval and exact targets.
- No additional specialist approval pass is required. The implementer owns focused tests, the
  configured checks, and a concise self-review of the final diff.

## Handoff

- Lead with the outcome, list changed surfaces, report commands actually run, and name remaining
  risks or unverified platforms.
- Do not claim another OS/device, external service, migration, or end-to-end path was verified when
  it was not exercised.
- If work continues elsewhere, leave the Linear branch handoff described in
  `.agents/coordination.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
