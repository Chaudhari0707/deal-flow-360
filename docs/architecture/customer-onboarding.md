# Customer credential onboarding

DF-21 requires a customer created by staff to receive a usable portal password. The implementation
restricts creation to managers and admins through the shared `customerCreate` permission in the UI,
Elysia route, and provisioning service. Representatives retain directory access but cannot create
customers; denied requests make no writes or email sends. This role restriction follows the
maintainer's updated scope. The implementation
uses Better Auth credential provisioning inside the customer transaction, with automatic sign-in
disabled on that provisioning instance. The creating employee keeps their session. A profile bound
to the new customer is created before commit, so the account cannot briefly inherit the default Rep
role. Existing customer or account email conflicts return 409; accounts are never silently linked.

The same transaction persists an encrypted Resend message intent. Sending happens after commit;
network requests never hold the customer transaction open. The encryption uses the existing
AES-GCM helper shared with quotation delivery and the server auth secret. Passwords, hashes and
encrypted payloads are excluded from API responses and audit details. Keep that secret stable:
changing it invalidates the ability to decrypt pending messages.

The create response adds `invitation: { id, status, message }` to the customer. `SENT` means provider
acceptance, not inbox receipt. A failure returns the saved customer with FAILED status. Staff can
read `GET /api/v1/customers/:id/invitation` and use
`POST /api/v1/customers/:id/invitation/retry`. Only the creating Rep, a Manager, or Admin can inspect
and retry that invitation. Retries reuse the same envelope and idempotency key. Confirmed sends
are not repeated; uncertain sends older than 23 hours are not automatically replayed beyond the
provider deduplication window. Contact edits never email; an email change prevents replaying the
original invitation to its former address. Account recovery after that window is not implemented.

Provider errors are mapped to fixed, actionable guidance for test-sender restrictions, unverified
domains, API-key permissions, invalid senders and rate limits. Raw provider messages are never
returned or audited because they can contain private email addresses. Unexpected/network errors
remain unconfirmed, not successful sends. Configure `EMAIL_FROM` with a verified-domain sender
before creating real customers: Resend's `onboarding@resend.dev` is restricted to testing, not
arbitrary customer addresses. See
[Resend's sender restriction](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).

Changing `EMAIL_FROM` affects new invitations only. Existing retries deliberately retain the saved
sender, content and idempotency key; they must not silently change an uncertain request's payload.
Verifying the saved sender's domain or correcting API-key configuration can unblock those retries.
An invitation created with the restricted test sender cannot be repaired merely by changing the
environment sender. That case still needs a separately implemented account-recovery flow; do not
delete a linked customer, expose the temporary password, or promise that repeated retries fix it.

The generated password is temporary: `profiles.must_change_password` defaults false for existing
accounts and is true for provisioned customers. `/me` exposes this flag, the login UI routes to
`/change-password`, and portal credential actions return 403 until replacement. Better Auth verifies
the old password and hashes the new one; its account-update hook clears the flag and encrypted
invitation payload. The form revokes other sessions. Reusing the same password in the standard
change-password request is rejected. Quote-scoped magic-link access remains a separate supported
path and does not turn into unrestricted credential access.

## Migration and rollback

`drizzle/0003_even_maggott.sql` adds `customer_invitations` and the default-false profile flag. It is
additive and does not provision or email existing contacts. Apply with `bun run db:migrate` before
starting this version; normal checks migrate only the isolated test database.

Rolling back to code without the password gate while temporary accounts exist is unsafe. Complete
their password changes or revoke those credential accounts first, preserving customer commercial
history and audit. Only then may an operator remove the invitation table and profile column in a
separately reviewed migration. Do not rewrite applied migration history or casually drop delivery
evidence. No automated rollback or recovery command is supplied.

## Verification

[Integration tests](../../test/integration/customer-onboarding.regression.test.ts) use real
Better Auth, Elysia and PostgreSQL and mock Resend at its client boundary. They cover atomicity,
collisions, parallel creation, usable credentials, forced change, secret exclusion, and retries.
[Browser tests](../../playwright/e2e/customer-onboarding.spec.ts) exercise the UI through a loopback
HTTP Resend substitute. Neither suite proves delivery to a real inbox. Existing contacts and linked
deletion rules remain covered by the customer lifecycle tests.
