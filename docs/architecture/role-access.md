# Shared role policy

DF-29, DF-30, DF-31 and DF-32 establish a single role policy in
`src/lib/domain/permissions.ts`. Elysia route allow-lists, sidebar entries and server-rendered
surface guards reuse it. Service-level ownership, customer identity, current approval step and
revision checks remain authoritative even when a role can enter a surface.

Admin configures products, warehouses, stock rows, price lists and policy and reads reporting and
quotations. Admin cannot write quotations, approve, impersonate customers, send quotations, receive
stock, dispatch, pay invoices, change subscriptions or nudge deals. Rep creates and owns commercial
terms; Manager and Finance act only at the current configured approval step. Ops performs stock
operations; Finance performs billing. The existing configurable approval-chain implementation is
preserved; its default remains Manager then Finance for HIGH.

Finance does not receive warehouses, stocks or reservations through the workspace aggregate. Ops
does not receive invoices, subscriptions, payments or credits. Manager/Admin reporting retains
financial visibility. Invoice PDF access is Rep-owned, Manager/Finance, or matching customer;
Admin uses reporting exports. Catalog is Admin-only; customer directory access is independent.

Customer directory read access includes Rep, Manager and Admin. Customer creation uses the separate
`customerCreate` permission (Manager/Admin only), enforced by both the API route and provisioning
service. Customer editing and deletion remain Manager/Admin only. Creation restrictions do not
remove representatives' ability to select existing customers when building quotations.

Stock UI lives within Fulfillment for Rep/Manager/Ops and within Settings for Admin. The legacy
`/inventory` path redirects accordingly; it is not added to navigation. Deep links use Next's
`forbidden()` under a dynamic Suspense leaf. With Cache Components the page shell can already be a
streamed HTTP 200; the page displays the 403 UI and protected content does not render. Application
API requests return actual HTTP 403. This distinction is tested and must not be represented as a
guarantee that every forbidden HTML response has HTTP status 403.

The alternative of hiding only buttons leaves direct APIs and bookmarked pages open; it is not an
authorization boundary. Conversely, permissions do not expand because a card has a convenient
link. Dashboard shortcuts follow the same policy.

Verification: [role browser matrix](../../playwright/e2e/role-access.spec.ts),
[API regressions](../../test/integration/workspace-access.regression.test.ts), and the existing
approval, portal, quotation journey, inventory and billing suites. New role or surface decisions
must update the policy, these tests, and the [flow guides](../flows/README.md) together.
