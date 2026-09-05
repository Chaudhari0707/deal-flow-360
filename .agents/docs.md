# Documentation

- Document decisions that future contributors must preserve, not a chronological build diary.
- Architecture docs are written only after a decision is approved in Linear or established by code.
  Include context, decision, alternatives, consequences, and verification.
- Update API contracts, migrations, env examples, operational steps, and affected instructions in
  the same change as behavior.
- Use Mermaid only when it materially clarifies a relationship or sequence. Add `accTitle` and
  `accDescr`; labels must remain understandable without color.
- Never paste secrets, private customer data, private Linear exports, or raw internal transcripts.
- Keep links relative where possible and verify moved/renamed targets.
