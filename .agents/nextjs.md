# Next.js and React

The installed Next.js version is the authority. Before framework-adjacent work, read the relevant
guide under `node_modules/next/dist/docs/` or use the configured Next.js documentation tool. Do not
rely on remembered APIs when local docs differ.

- Use the App Router. Prefer Server Components; add `"use client"` only at the smallest interactive
  boundary.
- `cacheComponents` is enabled. Keep dynamic APIs such as `cookies()`, `headers()`, and route search
  parameters in a small async leaf under `Suspense` when reading them at the top would block the
  static shell.
- Next navigation helpers such as `redirect()` and `notFound()` use control-flow errors. If a catch
  can intercept them, rethrow with the version-supported Next helper before handling other errors.
- Cache invalidation belongs in Server Actions or Route Handlers, never during render or inside a
  cached function.
- Every route group SHOULD have intentional loading, error, not-found, and empty states when the
  task requires those paths. Error recovery must refetch when the installed API distinguishes retry
  from local reset.
- Keep secrets and privileged data in server-only modules. Client modules may read only public env
  variables.
- Update `next.config.ts` CSP sources only for a task-approved integration and document why each new
  host is needed.
- Better Auth credentials and Resend are selected. Social login, deployment, image hosting,
  analytics, payments, storage, and email-verification policy remain unselected until approved.
- Keep `postcss.config.ts` canonical and use native Turbopack, which discovers it directly. Verify
  compiled styles in the browser; a successful build alone does not prove Tailwind was processed.
- Preserve the document-package bundling in `next.config.ts`; Bun's first cold request cannot
  resolve Turbopack's newly generated external aliases. See `docs/architecture/runtime.md` and
  verify cold API, stylesheet, PDF, and XLSX behavior when changing the bundler or package layout.
