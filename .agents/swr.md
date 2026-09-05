# SWR Client Data

- Prefer Server Components for initial page data. Use SWR when a client surface needs revalidation,
  request deduplication, mutations, polling/focus refresh, or detail caching across mounts.
- Use structured stable keys containing every request input. Pass `null` when prerequisites are
  missing; do not fetch and discard.
- Use the shared fetcher/provider. Do not create component-local fetcher variants or Map caches.
- After a mutation, update the exact affected cache key and relevant collection keys. Use optimistic
  data only with rollback-on-error and a server response that remains authoritative.
- Revalidation-on-focus is the default. Disable it only for an immutable or explicitly controlled
  surface, not to hide a stale-data bug.
- Server-paginated tables keep previous data while the next key loads and expose an intentional
  loading/revalidating state.
- Never put secrets or authorization tokens in SWR keys, logs, or client-readable fallback data.
