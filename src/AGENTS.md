# Source Rules

Follow the active Linear task and relevant playbooks in `.agents/index.md`.

- Product architecture is not implied by this directory. Match approved decisions and existing code.
- Use `@/` for cross-directory source imports and keep types strict.
- Keep privileged logic and secrets on the server; client boundaries stay small.
- New behavior needs focused tests and intentional loading/error/empty/permission states where
  applicable.
