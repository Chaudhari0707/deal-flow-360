# Frontend

- Derive information architecture, design system, state ownership, and component boundaries from the
  approved task and existing UI; do not treat planning mockups as technical architecture.
- Prefer semantic HTML and accessible names. All interactive controls need keyboard access, visible
  focus, labels, and appropriate status/error announcement.
- Keep server state, URL state, form state, and transient UI state distinct. Do not mirror derived
  values into effects.
- Validate forms live enough to guide the user, then validate again on the server. Submission errors
  must remain visible and actionable.
- Build loading, empty, error, success, disabled, and permission-denied states when applicable.
- Preserve responsive behavior and test the viewport/device named by acceptance criteria.
- Reuse existing primitives and tokens. Add a shared abstraction only after a repeated, stable
  pattern exists.
