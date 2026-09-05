# Tooling and Scripts

- Use Bun for installs, scripts, tests, and CLI execution. Use `bun --bun x` for shebang-wrapped
  package CLIs.
- Prefer Bun and Web APIs in repository scripts. Keep scripts cross-platform; do not depend on Bash,
  PowerShell, drive letters, `/tmp`, or shell-specific path separators.
- Resolve repository paths from `import.meta.dir` or `import.meta.url`, not the caller's working
  directory.
- Every imported package MUST be declared directly in `package.json`. Do not rely on hoisting.
- `.env.local` and `.env.test.local` are ignored machine-local files. `.env.example` and
  `.env.test.example` are sanitized contracts and MUST remain current.
- Scripts MUST validate arguments, print actionable errors, and exit non-zero on failure.
- Destructive scripts require an explicit confirmation/force flag, exact resolved targets, and a
  dry-run mode when practical.
- CLI scripts are not Next.js Server Components. Do not import a chain that depends on `server-only`,
  request context, or Next cache APIs.
- Never print tokens, passwords, full database URLs, magic links, or private customer data.
