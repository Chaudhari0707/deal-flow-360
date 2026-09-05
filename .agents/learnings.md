# Durable Lessons

Add only verified, reusable project-specific lessons using this format:

```text
YYYY-MM-DD | scope | durable rule | evidence path or test
```

Do not add task status, speculation, private issue content, customer data, credentials, or raw
conversation history. Promote a lesson only after the same rule has independent evidence twice;
move it into the canonical routed playbook and remove the duplicate entry here.

2026-09-05 | Better Auth schema | Match the `auth` CLI version to the installed Better Auth runtime;
the legacy `@better-auth/cli` 1.4 generator omits the required 1.7 account issuer identity. Generate
and migrate with the matching CLI before credential tests. | `scripts/generate-auth-schema.ts`,
`drizzle/0002_abandoned_living_mummy.sql`, credential integration regressions.
