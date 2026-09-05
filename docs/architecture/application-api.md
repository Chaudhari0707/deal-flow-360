# Application API architecture

## Context

DealFlow360 runs Elysia inside Next.js App Router. The prior API had correct behavior but mixed
large controllers, repeated session resolution, incomplete reusable contracts, and handwritten
browser response assertions. An explicit Next.js `OPTIONS` export also delegated an unsupported
method to Elysia and produced an accidental `404` instead of the framework's BFF response.

## Decision

Elysia remains the only application API under `/api/v1`; Better Auth keeps its dedicated
`/api/auth` handler. `src/server/api.ts` composes one tagged Elysia controller per feature, shared
errors, models, and OpenAPI. Feature folders own `routes.ts` transport declarations and `model.ts`
contracts. Named query, service, or mutation modules receive explicit inputs and actors when logic
is substantial enough to test independently. They never receive the full Elysia Context.

Protected controllers use the scoped `actorContext` macro and declare `authorize: true | Role[]`.
The macro resolves a typed actor from Better Auth headers and enforces mutation origins. Portal
link identity remains a separate, quote-scoped boundary. SQL resource scoping and transactional
invariants stay inside the appropriate query or mutation operation.

Every route validates external input and declares successful plus stable error responses. Reusable
schemas feed both OpenAPI and the exported `typeof api` contract. A Promise-returning handler with
a response schema is always declared `async`; compiled App Router validation must receive the
resolved value rather than a Promise object.

First-party browser JSON traffic uses one relative same-origin Eden Treaty client with a type-only
application import and shared result/error adaptation. This preserves cookies, ISO date transport,
SWR keys, and user-facing failures without duplicating response types. Binary reports remain native
browser downloads. Server code calls feature operations directly; it does not loop back over HTTP.

The optional App Router catch-all is a zero-logic `api.fetch` adapter for DELETE, GET, PATCH, POST,
and PUT. With installed Next.js 16.3.3, omitted HEAD delegates to GET and omitted OPTIONS returns
`204` with the supported `Allow` methods. The same-origin BFF does not add cross-origin headers.
Elysia is never started with `.listen()` inside Next.js and neither API mount is duplicated.

## Alternatives

- A classic controller/service/repository hierarchy was rejected because it would add generic
  layers without changing this application's transaction or ownership boundaries.
- Raw browser `fetch` wrappers and handwritten response interfaces were rejected because they can
  drift from the validated Elysia contract.
- An Elysia-owned catch-all OPTIONS route was rejected because this BFF does not expose CORS and
  Next.js already derives the correct supported-method response.
- A separate Elysia listener or server loopback client was rejected because Next.js already owns
  the process and can invoke the application or feature functions directly.

## Consequences and verification

Feature changes now update controller schemas, OpenAPI, typed client behavior, and tests together.
The explicit feature boundary adds a few files but makes business queries and mutations testable
without transport context. The critical integration risks are type erasure at the browser boundary
and different compiled adapter behavior, so verification includes OpenAPI and Eden unit contracts,
real PostgreSQL integration tests, a production build, and Playwright through Next.js. The adapter
regression fixes GET/HEAD/OPTIONS behavior to the installed Next.js version and same-origin policy.
