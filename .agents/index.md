# Routed Playbooks

Load only what the task touches.

| Trigger | Playbook |
| --- | --- |
| Linear issue, worktree, parallel device, branch handoff | `.agents/coordination.md` |
| Next.js, React Server Components, routes, caching | `.agents/nextjs.md` |
| Elysia application API, Eden client, OpenAPI | `.agents/elysia.md` |
| Better Auth, sessions, login, password, account access | `.agents/auth.md` |
| Resend, transactional email, verification/reset delivery | `.agents/email.md` |
| shadcn/ui components, tokens, component installation | `.agents/shadcn.md` |
| Bun, scripts, commands, package execution | `.agents/tooling.md` |
| Unit, integration, E2E, regression, flaky tests | `.agents/testing.md` |
| Dependency add, removal, or version change | `.agents/dependencies.md` |
| API endpoint or server mutation | `.agents/api.md` |
| Database schema, migration, query, or transaction | `.agents/database.md` |
| Seed, reset, fixture, demo/reference data | `.agents/seeding.md` |
| UI, forms, accessibility, client state | `.agents/frontend.md` |
| Authentication, authorization, secrets, hostile input | `.agents/security.md` |
| Architecture docs, public docs, diagrams | `.agents/docs.md` |
| Agent instruction or harness changes | `.agents/instructions.md` |
| Lessons, durable repository memory | `.agents/memory.md` |

Specialized agents may help divide a large task but are optional and never mandatory approval gates.
