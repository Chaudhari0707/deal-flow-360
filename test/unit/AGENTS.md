# Unit Tests

- Test pure behavior without PostgreSQL, HTTP servers, filesystem state, or browsers.
- Keep fixtures small and explicit; use tables for boundary cases.
- A unit regression uses `*.regression.test.ts` and states the original failing observable.
