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

2026-09-06 | Dialog scroll | Do not put `overflow-y-auto` on the whole dialog popup when
`DialogFooter` is sticky; only the body may scroll or the footer overlays the last fields
(reason, quantity). | `src/components/ui/dialog.tsx`, `src/features/inventory/override-form.tsx`

2026-09-06 | Elysia responses | With `normalize: false`, a 200 schema rejects extra keys after the
write commits. Returning `status` from ship made the first click 400 and the operationKey
retry 200. | `test/unit/inventory-movement-response.test.ts`

2026-09-06 | Elysia Intersect | Next's compiled adapter can 400 `t.Intersect` response rows that
`api.handle` accepts. Flatten snapshot objects instead of intersecting `stockModel`. |
`src/features/inventory/model.ts` inventory snapshot stocks.
2026-09-06 | Quotation recommendations | Validate transient form values before calculating dependent
recommendation prices; an empty or out-of-range discount must not throw out of render and replace
the editor with a workspace error. | `playwright/e2e/number-input.spec.ts`

2026-09-06 | Customer provisioning | Better Auth signup with autoSignIn disabled may return a
synthetic success for an existing email. Check the persisted identity inside the customer/profile
transaction; never attach a pre-existing account or replace the creating staff session. |
`test/integration/customer-onboarding.regression.test.ts`

2026-09-06 | Report refresh | SWR can retain previous data alongside an error. Do not let cached
data hide a failed report refresh or enable exports while the current selection is unverified. |
`playwright/e2e/reports.spec.ts` expired-session refresh.
