# Durable Lessons

Add only verified, reusable project-specific lessons using this format:

```text
YYYY-MM-DD | scope | durable rule | evidence path or test
```

Do not add task status, speculation, private issue content, customer data, credentials, or raw
conversation history. Promote a lesson only after the same rule has independent evidence twice;
move it into the canonical routed playbook and remove the duplicate entry here.

2026-09-05 | Subscription amounts | Preserve the original rational price/quantity basis when changing
quantities; repeatedly scaling rounded totals can gain or lose a cent. |
`test/integration/billing.regression.test.ts` quantity round-trip regression.

2026-09-05 | Numeric form controls | Keep a numeric field's raw text until blur; coercing every
keystroke drops valid leading-zero decimal states. | `test/unit/number-input.regression.test.ts`
