# Architecture guide

The maintainer authorized these implementation decisions through the local delivery request and
Linear phase contracts. Read them in this order:

1. [System design and product decisions](001-local-delivery.md): component diagram, money/risk rules,
   transaction boundaries, authorization and the growth path.
2. [Application API](application-api.md): Elysia feature boundaries, contracts, authorization, Eden,
   and the Next.js adapter.
3. [Interface and portal](ui.md): shadcn/tweakcn choices, authentication, client state and customer flows.
4. [Inventory](inventory.md): reservations, warehouse splitting, concurrent updates and realtime delivery.
5. [Billing](billing.md): schedules, proration, invoice/payment/credit ledgers and reporting.
6. [Native runtime compatibility](runtime.md): TypeScript PostCSS, Turbopack and Bun package loading.
7. [Implemented data model](data-model.md): actual relationships, snapshots and integrity constraints.
8. [Quotation recommendations](quotation-recommendations.md): last-purchase suggestions and best-seller fallback.
9. [Customer management](customer-management.md): directory permissions, safe deletion, login email synchronization, and tier policy.
10. [Workspace currency](currency.md): INR presentation, paise storage compatibility, and PDF/XLS labels.

The core invariant is simple: a customer confirms an **approved revision**, and one database
transaction creates the order, reserves available stock and records initial billing. Email and live
screen updates describe committed facts. They do not authorize financial or stock changes.

Internal access is explicit: representatives own their quotations and linked financial records;
manager/finance/admin roles can read their operational scope; Ops has fulfillment access without
billing datasets. Representatives share customer/product/stock reference catalogs, including costs
needed for sales margin calculations. Customers see only their records and no internal margin/audit.
Only customer identities and scoped quotation-link sessions can use customer-portal actions.
See the real workspace-access regression suite for direct endpoint and token isolation evidence.

Local planning drafts under `docs/product/` remain background input. The documents above and the
implemented contracts supersede their unresolved architecture options.
