# DealFlow360 delivery plan

This is the implemented local hackathon plan. The PDF reference is
[DealFlow360.pdf](docs/product/DealFlow360.pdf). Detailed business and architecture decisions are in
[the architecture guide](docs/architecture/README.md); the executable walkthrough is in
[the demo guide](docs/demo.md).

## Phase ownership

| Phase | Linear issue | Contributor | Outcome |
| --- | --- | --- | --- |
| 0 | DF-5 | 0monish | Selected contracts, real PostgreSQL schema, migrations and isolated environments |
| 1 | DF-6 | jay3chauhan | Credentials, shadcn/Supabase workspace, customer portal and configuration |
| 1 | DF-7 | 0monish | Pricing, tier policies, quotations, approval revisions and atomic confirmation |
| 1 | DF-8 | MitvaVirvadiya | Warehouse allocation, stock ledger, shipment/backorder operations and sockets |
| 1 | DF-9 | Chaudhari0707 | Subscription billing, credits, payments, PDF/XLSX and sales/financial reporting |
| 2 | DF-10 | jay3chauhan | Real browser journeys and authorization/style regressions |
| 2 | DF-11 | MitvaVirvadiya | Concurrent writes, restart recovery, local runtime and measured read workload |
| 3 | DF-12 | 0monish | CodeRabbit review, evidence-based resolution and security corrections |
| 3 | DF-13 | Chaudhari0707 | Demo, diagrams, verification and release handoff |

## One complete deal

1. Configure customers/tiers, catalog SKUs, pricing/discount policies, warehouses and recurring plans.
2. Rep creates a quote. Line and order discounts update prices, margins and per-category risk live.
3. NONE auto-approves; MEDIUM routes to Manager; HIGH routes through Manager and Finance.
4. The approved quotation is emailed with restricted access. Customers can ask questions or counter
   terms. A commercial counter creates a new revision and repeats the required approval route.
5. A customer confirms the approved revision. One transaction creates the order, reserves available
   stock, records backorders and creates separate one-time/recurring billing.
6. Ops accepts or overrides the allocation, restocks, consolidates remaining demand and ships.
   Both stock views receive committed quantities over authenticated sockets.
7. Finance records full-balance payments, manages recurring periods/changes/cancellation credits,
   and downloads actual PDFs. Automatic billing resumes due work after companion restarts.
8. Health alerts and filtered sales/financial reports use the same persisted records.

## Acceptance and release gates

- Two complete flows: an in-policy deal to payment, and the HIGH approval/customer-counter hybrid deal.
- Hero fixture: 24 laptops plus services and Care Plan; final one-time invoice $26,805.24, recurring
  invoice $46, and Main 22 / East 2 reservations from the initial availability fixture.
- Real credentials and PostgreSQL in integration/browser tests. First-party logic is exercised;
  Resend is simulated only at its provider boundary in automated suites.
- No overselling, duplicated billing, stale approval acceptance or cross-customer record access in
  the covered regressions. PDF/XLSX contents and compiled TypeScript PostCSS styles are checked.
- `bun run check:full`, a local production-mode smoke, CodeRabbit resolution and the modest load
  measurement form the release evidence. Counts and limitations are in
  [verification](docs/engineering/verification.md).
- Promote verified feature PRs through `dev`, then the repository's production branch `prod`, then
  `main`. This is source promotion only; hosting is outside this task.

## Deliberate boundaries

One selling organization, USD, three active warehouses, same-cadence subscription changes,
full-balance payments and source-linked credits. No external card network, cash refunds,
cross-invoice credit application, multi-company or hosted deployment is claimed.

Dependency follow-up DF-14 is parked separately for two moderate transitive advisories and their
supported upstream upgrade path. Their affected features were not found in the exercised workflows;
this does not claim a clean dependency audit.
