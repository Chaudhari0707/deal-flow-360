# API and Server Mutations

- Better Auth owns `/api/auth/[...all]` through its dedicated Next.js handler. Elysia owns application
  endpoints under `/api/v1/[[...slugs]]`. Mount each once; route files only adapt framework requests.
- Do not introduce a second API framework or speculative service layer.
- Validate path, query, headers, and body at the boundary with a shared schema. Reject unknown or
  malformed input intentionally.
- Authenticate identity and authorize the specific resource/action on the server. Client visibility
  is not authorization.
- Protected Elysia routes MUST use `actorContext` plus `authorize`; authorization remains
  server-side. See `.agents/elysia.md` for feature boundaries and first-party client rules.
- Promise-returning Elysia handlers with response schemas MUST be declared `async`, including thin
  service delegates, so compiled response validation receives the resolved value.
- The Next.js catch-all MUST remain a direct `api.fetch` adapter. Export application methods only;
  installed Next.js owns the selected automatic HEAD and OPTIONS behavior.
- Distinguish validation, unauthenticated, forbidden, not-found, conflict, rate-limit, and unexpected
  failures with stable response shapes.
- Multi-step writes that form one invariant MUST be transactional. Do not hold a transaction open
  across external network calls.
- Retried mutations and webhook-like inputs need an explicit idempotency decision.
- Avoid query-in-a-loop behavior and unbounded list responses. Pagination order must be stable.
- Add failure-first contract tests and update the canonical API documentation in the same task.
