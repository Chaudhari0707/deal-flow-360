# App Router Rules

Read `.agents/nextjs.md`, `.agents/frontend.md`, and `.agents/security.md` before route work.

- Route files own framework composition, metadata, and boundary states.
- Keep dynamic APIs in scoped async leaves when cache components require it.
- Do not swallow Next.js navigation control flow in broad catches.
- Route mutations validate and authorize on the server and update relevant cache contracts.
- The root layout MUST mount `AppProviders` once for SWR and tooltip context.
