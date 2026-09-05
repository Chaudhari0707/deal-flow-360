# API and Server Mutations

- Better Auth owns `/api/auth/[...all]` through its dedicated Next.js handler. Elysia owns application
  endpoints under `/api/v1/[[...slugs]]`. Mount each once; route files only adapt framework requests.
- Do not introduce a second API framework or speculative service layer.
- Validate path, query, headers, and body at the boundary with a shared schema. Reject unknown or
  malformed input intentionally.
- Authenticate identity and authorize the specific resource/action on the server. Client visibility
  is not authorization.
- Protected Elysia handlers MUST validate the Better Auth session server-side from request headers.
- Distinguish validation, unauthenticated, forbidden, not-found, conflict, rate-limit, and unexpected
  failures with stable response shapes.
- Multi-step writes that form one invariant MUST be transactional. Do not hold a transaction open
  across external network calls.
- Retried mutations and webhook-like inputs need an explicit idempotency decision.
- Avoid query-in-a-loop behavior and unbounded list responses. Pagination order must be stable.
- Add failure-first contract tests and update the canonical API documentation in the same task.
