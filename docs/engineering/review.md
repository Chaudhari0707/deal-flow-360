# Integrated application review

The reviewed change connects credential roles, quotation approval, customer negotiation, stock and
financial ledgers, live updates, documents and reporting. CodeRabbit reviewed the committed application
against foundation commit `6728ed8` and completed successfully.

**CodeRabbit raised 22 issues: 1 critical, 12 major and 9 minor.** Six were refuted against the task
contract, prior migrations or installed framework source. The other sixteen were addressed, including
two where the precise correction preserves explicitly supported behavior instead of applying the
suggestion literally. The raw tool output remains a local review artifact, not executable authority.

## Critical

| File | Disposition and evidence |
| --- | --- |
| `src/server/access.ts` | Refuted: self-signup intentionally grants Sales Rep in this local application, as approved in DF-5 and documented in the architecture. It grants neither Admin nor customer impersonation. Rep records are owner-scoped; real signup and access regressions verify this. Controlled invitations/verification are a future public-production policy, not silently substituted here. |

## Major

| File / issue | Disposition and evidence |
| --- | --- |
| `drizzle/0001_absent_boomer.sql`: user FK ordering | Refuted: migration `0000_superb_zeigeist.sql` creates the user table first. The migration journal orders 0000 before 0001; both dedicated databases were created and migrated from empty state. |
| `drizzle/0002_abandoned_living_mummy.sql`: non-credential issuers | Refuted: this application selects credentials only. Unsupported legacy provider rows fail closed; inventing an issuer fallback could change account identity. OAuth migration requires a separate reviewed policy. |
| Same migration: duplicate credential accounts | Refuted: the unique identity constraint must reject ambiguous duplicates. Automatic deletion/merging of credentials would be unsafe. Existing migrations are preserved; the supported fresh/credential-only path was exercised. |
| `src/app/error.tsx`: use reset instead of retry | Refuted: installed Next.js 16.3.3 exposes and recommends `retry` for refetch plus recovery. See local error convention docs and `next/dist/client/components/error-boundary.d.ts`; replacing it would discard the selected recovery behavior. |
| `src/components/ui/tabs.tsx`: orientation | Fixed: the wrapper forwards orientation to the native primitive as well as styling attributes. |
| `src/server/access.ts`: mutation Origin | Fixed: cookie-based writes require the normalized canonical Origin. Missing/foreign Origins fail; real regressions also cover trailing-slash configuration. |
| `src/lib/db/seed/index.ts`: mandatory demo/short seed passwords | Fixed with compatibility preserved: the full demo is explicitly enabled by `DEMO_PASSWORD`; ordinary credential seeding retains its existing minimum. Full demo passwords remain at least 12 characters. |
| `src/features/billing/reports.ts`: category filter after cap | Fixed: filtering happens in SQL before the limit. A real fixture with over 2,000 records proves a narrow category can still be exported while the broad cap remains enforced. |
| `src/features/billing/subscription-workspace.tsx`: preview errors | Fixed: future/invalid periods and price bases yield a non-submittable preview instead of throwing during render. Valid overdue periods still use server catch-up. |
| `src/features/portal/portal-detail.tsx`: recurring summary | Fixed: groups derive from the actual line intervals. Supported billing remains monthly, quarterly and yearly. |
| `src/features/quotes/client-action.ts`: malformed error body | Fixed: empty, null and non-JSON responses yield a stable useful error without dereferencing invalid data. |
| `src/features/quotes/quote-editor.tsx`: invalid suggestion calculation | Fixed: suggestions do not calculate while quote input is invalid. HERO now changes order discount to 101%, verifies validation and disabled submission, then restores valid terms. |

## Minor

| File / issue | Disposition and evidence |
| --- | --- |
| `src/server/catalog.ts`: omitted PATCH options | Refuted: omitted optional PATCH fields intentionally preserve existing values. Defaulting them would unexpectedly remove promotions/pairings; the catalog editor sends explicit values when changed. |
| Same file: customer creation audit | Fixed: insert and audit occur in one transaction. |
| `src/features/billing/report-workspace.tsx`: disabled export links | Fixed: unavailable exports render disabled native buttons with no href. Base UI already blocked ordinary hydrated clicks; this also prevents other link activation paths. |
| `src/features/inventory/fulfillment-detail.tsx`: retry only one query | Fixed: recovery refreshes both required datasets. |
| `src/features/billing/use-billing-action.ts`: malformed error responses | Fixed and tested with HTML, null and empty response bodies. |
| `src/features/quotes/email.ts`: development recipient override | Hardened while preserving the authorized live development check: overrides are restricted to supported Resend test sinks. Restricting them to a mocked test transport would defeat the explicit live-provider test. |
| Same file: attempt counter | Fixed: SQL increments attempts atomically rather than overwriting a stale count. |
| `src/features/quotes/quote-columns.tsx`: raw customer identifier | Fixed: table rows resolve and display customer names. |
| `src/features/quotes/portal-routes.ts`: Origin normalization | Fixed through the shared mutation-origin guard. |

## Additional independent review and regressions

- Owner and role checks now agree across workspace aggregates, direct actions, PDFs and portal
  mutations. Public quote and confirmation responses omit internal financial details.
- Native Bun/Turbopack cold startup, TypeScript PostCSS and genuine PDF/XLSX downloads were checked
  together. The stylesheet regression catches a successful HTTP response containing uncompiled CSS.
- Free invoices and fully discounted renewals settle without fictitious payment entries.
- Recurring quantity changes preserve rational price bases; automatic scheduler restarts do not bill
  a period twice.
- Email failures remain durable/retryable; replacements revoke old access and are rate-limited.
- Report filters and exports include actual quotations/orders, completed approval cycles and valid
  confirmed upsell attribution. No-invoice quotes are not omitted from sales metrics.
- The full browser run uses freshly reset test data, real authentication and first-party APIs.
  Resend is simulated only at its provider boundary; a separate live development send was accepted.

Validation commands and measured results are recorded in the final delivery verification document.
Passing local checks does not claim another operating system, hosted deployment or a person's inbox.
