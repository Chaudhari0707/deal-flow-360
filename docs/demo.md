# Five-minute DealFlow360 demo

Use `bun run local` and open http://127.0.0.1:3000. Passwords are supplied in your ignored local
environment; the role emails are listed in the root README. Keep separate browser profiles for Rep,
Manager, Finance, Ops and Customer, or sign out between roles.

## Explain the system in 30 seconds

A quotation contains proposed terms. The strictest customer/category discount ceiling decides its
approval route. Approval belongs to a revision, so a customer counter invalidates old permission.
Confirmation creates one order, reserves real available stock and creates separate one-time and
recurring billing in one PostgreSQL transaction. Payment and shipment remain separate facts.

**सरल explanation:** पहले quotation बनता है, फिर discount के हिसाब से approval जाता है। Customer
terms बदलता है तो नया revision फिर approve होता है। Final confirm पर stock reserve और billing
एक ही transaction में होते हैं—इसलिए double click से duplicate order या invoice नहीं बनता।

## Flow 1 — clean deal to payment

1. Sign in as Rep and open draft **Q-1016**. It contains two Wireless Mice with in-policy discounts.
2. Save and submit. Risk is NONE, so the quote approves automatically and queues its email.
3. Sign in as Acme customer, open the quotation in the separate portal and confirm its approved terms.
4. In Ops, accept the suggested split and record shipment. In Finance, open the one-time invoice,
   enter a payment reference and record the outstanding amount. Download its real PDF.

Expected sample one-time total is **$78.66** with the unchanged seeded pricing. All figures come from
application rules, not hardcoded display values.

## Flow 2 — governed hybrid deal and customer counter

1. As Rep open draft **Q-1042**: 24 Laptop Pro 14 at 12%, Setup at 18%, Warranty at 10%.
   The Services ceiling is 10%, so Setup is eight percentage points over and the quote is HIGH.
2. Add the Care Plan 2yr upsell. Show the separate recurring charge and matching-period margin.
   Save and submit; Rep has no approval action.
3. Manager reviews the reasons and approves. Finance approves the second step. Each decision needs
   a reason and appears in the audit. The system sends the approved quotation email.
4. As Acme customer open the quote and counter Warranty to **15%**. Confirmation is blocked while
   the new revision goes through Manager and Finance again. A plain message alone does not invalidate
   an approval.
5. After reapproval, Acme confirms. In Ops show **22 Main + 2 East** reservations. In Finance show
   **$26,805.24 one-time** and **$46 recurring**, then record payment/download PDF.

The 22/2 split assumes the initial seed or equivalent availability; another confirmed order may
legitimately change it. The automated HERO browser test uses freshly reset test data and asserts the
exact invoice values, reservation quantities and single subscription.

## Supporting demonstrations

- In Ops, open fulfilled **SO-1021** (Zenith). The split shows 2 Docking Stations and 4 Wireless
  Mice at Main, all shipped, with matching SHIP movement history. Harbor **SO-1024** and Northwind
  **SO-1022** stay backorders. Service-only fulfilled rows such as Orion **SO-1026** show
  **No stockable lines**, not a missing warehouse split. The order lines table still lists
  the confirmed services from the API.
- Open two Ops inventory tabs. Restock eight Laptop Pro 13 units at East; both tabs update over an
  authenticated socket. Consolidate Northwind's remaining four backordered units, accept without
  reserving twice, then ship. The ledger retains other orders' stock.
- In Finance, change a subscription quantity and inspect its prorated adjustment. Cancel it, inspect
  the credit and confirm that future billing stops. Repeat the due run to demonstrate idempotency.
- Open Deal Health: stalled quotes, unusually high discounts versus the same rep's history, approval
  delay and real delivery slippage link to their source records. Record a nudge and show its audit.
- Filter Reports by dates, representative, approval status and category/product. Export PDF and XLSX.
- Show that a Rep cannot approve or modify another Rep's quote, Ops cannot access finances, and a
  customer cannot change another customer's ID in the URL to obtain their data.

## Questions a reviewer may ask

| Question | Explanation |
| --- | --- |
| How do you avoid overselling? | Stock rows are locked and reservations checked inside the same transaction; a second buyer sees the committed remainder. |
| Can a HIGH deal ever be confirmed? | Yes, when its exact current revision has completed the required approval chain. Risk describes review needs, not permanent rejection. |
| What if a confirm or payment is retried? | Unique business-operation identities and transactional checks prevent duplicate effects. |
| Why separate invoices? | One-time sales and recurring periods have different schedules, while both still trace to the same order. |
| Are sockets authoritative? | No. They refresh screens from committed data; the server rechecks stock before allocating. |
| Why no Redis or microservices yet? | Local indexed PostgreSQL and bounded modules meet the demonstrated workload. Extra infrastructure follows measured bottlenecks. |
| Did you send a real email? | Automated suites use a provider-boundary test transport. A separate live Resend test reports provider acceptance; a test sink is not proof of a person's inbox delivery. |

## Reset and next steps

`bun run test:e2e` resets only the dedicated `_test` database. The development seed is idempotent and
preserves an already-started demo. To restart the development demo, review the exact local `_dev`
target and use the guarded `bun run db:reset -- --force` command, followed by the documented migration/
seed sequence if required by its output. Never use development reset against shared/customer data.

Future work: cross-invoice credit allocation and cash refunds, cross-cadence plans, larger paginated
workspace projections, distributed job execution, multi-company/currency, and measured production
availability/backup goals. These do not substitute for the implemented local end-to-end paths.
