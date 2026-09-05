# Elysia and Eden

- Elysia owns application APIs under `/api/v1`; Better Auth remains on its dedicated `/api/auth`
  Next.js handler. Do not mount either twice.
- Export the Elysia instance and adapt supported HTTP methods through one Next.js catch-all route.
- Validate path, query, header, cookie, and body input with Elysia schemas at the boundary.
- Keep stable success/error response contracts and document routes through the configured OpenAPI
  plugin. Do not expose secrets or internal exception detail in the schema.
- Eden clients consume the exported application type; they do not replace server authorization or
  runtime validation.
- Plugins and route groups must be composable and avoid calling `.listen()` inside Next.js.
