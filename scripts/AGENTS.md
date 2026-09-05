# Script Rules

Follow `.agents/tooling.md` and `.agents/security.md`.

- Scripts MUST be cross-platform and resolve paths from `import.meta.dir`/`import.meta.url`.
- Scripts MUST NOT import request-context, `server-only`, or Next cache modules.
- Destructive behavior requires exact validated targets and explicit confirmation.
- Print actionable summaries and return non-zero on failure; never log secrets or private data.
