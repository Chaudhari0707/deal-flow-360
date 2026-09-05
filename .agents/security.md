# Security

- Treat all external, URL, form, file, webhook, and AI-produced input as untrusted.
- Enforce least privilege and server-side authorization for every protected action and object.
- Never expose server secrets through client bundles, public env variables, logs, errors, fixtures,
  screenshots, or Linear comments.
- Use framework/library protections for sessions, cookies, CSRF, output encoding, and password/token
  handling; do not invent cryptography.
- Preserve CSP and security headers. New external origins require a documented task reason and the
  narrowest directive.
- Prevent enumeration in account recovery, invitations, and magic-link flows where relevant.
- Magic links and similar bearer tokens must be short-lived, scoped, single-use or rotating, stored
  safely, and redacted from logs.
- File handling requires type/size checks, generated storage names, and a deliberate public/private
  access decision.
- Before handoff, inspect the diff for secrets, debug endpoints, permissive fallbacks, missing auth,
  and unsafe HTML/URL handling.
