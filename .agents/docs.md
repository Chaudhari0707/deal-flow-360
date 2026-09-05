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

## Evolving project flows

- `docs/flows/README.md` is the user-flow and test-coverage index. Extend the appropriate guide
  when a feature grows; add a guide and index entry for a new domain. Do not append change diaries.
- A changed flow MUST document actors and permissions, entry point, prerequisites, an example,
  observable outcome, and applicable denial, validation, retry, concurrency, and recovery paths.
- Keep Mermaid diagrams current when steps, decisions, ownership or state transitions change.
  Include `accTitle` and `accDescr`; use small linked diagrams rather than one unmaintainable graph.
- Link to the implementation and tests that establish the flow. Distinguish existing test coverage
  from executed checks, and implemented behavior from planned work or known limitations.
- Update affected neighboring flows when contracts cross domains (for example customer identity,
  quotation confirmation, reservations and first billing). Preserve snapshots and role boundaries.
- Verify relative links, examples, diagram syntax and instruction checks before handoff. Never
  claim an untested integration, live inbox, browser, platform or external service is verified.
