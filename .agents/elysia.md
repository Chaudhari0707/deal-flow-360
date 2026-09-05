# Elysia and Eden

- Elysia owns application APIs under `/api/v1`; Better Auth remains on its dedicated `/api/auth`
  Next.js handler. Do not mount either twice.
- `src/server/api.ts` owns composition, shared errors, and OpenAPI only. Each API feature owns one
  composable, tagged Elysia controller in `routes.ts`, boundary contracts in `model.ts`, and named
  query/service/mutation modules only when substantial logic needs a testable boundary. Do not
  force generic MVC, repository, or domain layers.
- Validate path, query, header, cookie, and body input at the controller boundary. Reuse request and
  response models, declare stable success/error responses, and keep OpenAPI tags/security complete.
- Protected feature controllers MUST use `actorContext`; every protected route declares
  `authorize: true | Role[]` and consumes the typed `actor`. Do not repeat `requireActor`, construct
  auth per handler, or pass the full Elysia Context into services. Portal token identity remains a
  separate scoped boundary.
- A handler that returns a Promise and declares a response schema MUST be `async`, including a thin
  delegate such as `async (...) => service(...)`. Otherwise the compiled Next.js adapter can
  validate the Promise object and return `400`.
- Browser JSON calls use the shared relative same-origin `treaty<Api>` client with a type-only API
  import and shared result/error adapter. Preserve cookies and date transport semantics; do not add
  raw fetch wrappers, handwritten response types, or generic JSON casts. Keep native downloads for
  PDF/XLSX responses.
- Server code calls named query/service functions directly, or uses in-process Treaty in contract
  tests. It MUST NOT make loopback HTTP calls to its own API.
- `src/app/api/v1/[[...slugs]]/route.ts` is a zero-logic adapter. Export only intentionally handled
  methods as `api.fetch`; let installed Next.js provide its selected HEAD/OPTIONS behavior. Never
  parse, authenticate, add business logic, call `.listen()`, or create another mount there.
- Contract changes require boundary, OpenAPI, Eden adaptation, and compiled adapter/browser tests
  appropriate to the changed path. Never expose secrets or internal exception details.
