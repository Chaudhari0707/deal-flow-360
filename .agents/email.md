# Resend Email

- Resend is the transactional email provider. The client and API key stay in server-only modules.
- `EMAIL_FROM` and all recipient/content inputs must be validated. Never log API keys, full magic or
  reset links, session tokens, or private message bodies. Resend requires `email@example.com` or
  `Name <email@example.com>`; a missing pair of angle brackets is a send failure, not a 4xx from our API.
- Retriable sends need a stable operation-scoped idempotency key. Persist delivery intent/status when
  the product flow requires auditability; do not infer delivery from a successful enqueue alone.
- Verification and password-reset responses must not reveal whether an account exists.
- Normal unit/integration/E2E tests mock Resend at the provider boundary and assert the complete
  message contract. Live delivery is opt-in and uses provider-supported test recipients.
- Verify webhook signatures before parsing/trusting events and handle duplicate events idempotently.
