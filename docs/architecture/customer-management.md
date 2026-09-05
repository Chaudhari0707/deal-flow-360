# Customer directory and tier policy

Customer operations are available under `/customers` and Catalog → Customers.
Sales representatives can create and read customer records. Managers and admins can
also edit and delete. Other roles do not have directory mutation rights. Existing rep
rows are read-only; the server enforces the same policy as the UI.

`POST /api/v1/customers` creates a contact, not a login invitation.
`PATCH /api/v1/customers/:id` updates name, email, tier and team. A changed email is
normalized and updates the single linked customer login in the same transaction,
clears its verified-email flag and revokes its sessions. Passwords remain unchanged.
Conflicting emails or ambiguous multiple/non-customer login links return 409 without
partial changes. Customer login provisioning is a separate workflow.

`DELETE /api/v1/customers/:id` returns the deleted customer (200), 404 for missing
records, or 409 for customers with quotations, linked logins or other FK references.
Deletion requires UI confirmation. A row lock and database foreign keys protect
against concurrent new references. Successful deletion writes an audit event; linked
commercial history is never cascaded. There is no archive flag or database migration.

Gold/Silver/Bronze are pricing tiers, not recurring subscription plans. Configurable
tier ceilings govern discretionary discounts; the effective ceiling is the lower of
the tier and category ceilings. Configured hardware tier prices apply before line and
order discounts. Non-hardware base prices are unchanged by that price list. A tier
ceiling is not an automatic discount. Existing quotation snapshots do not change when
customer master data changes; new quotes or explicit edits use the current tier.

Verification: `test/integration/customer-lifecycle.regression.test.ts`,
`playwright/e2e/customers.spec.ts`, and existing pricing/authorization regressions.
