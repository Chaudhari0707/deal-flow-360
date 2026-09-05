# Instruction Maintenance

- Root and nested `AGENTS.md` files are always-loaded and must contain only universal or path-local
  invariants. Situational procedures belong in `.agents/` and must be routed from `.agents/index.md`.
- `AGENTS.override.md` is forbidden because it can silently replace the canonical owner.
- Every rule has one canonical owner. Other files link to it and add only local detail.
- Prefer an executable lint/test/script check when a natural-language rule can be enforced reliably.
- Keep source-project history and migration attribution out of repository guidance. Instructions
  describe this repository as its own system.
- For instruction changes, run `bun run check:instructions`, verify routed links, and compare the
  final diff for duplication or conflicting requirements.
- Do not add mandatory approval agents or multi-agent review chains. Specialized prompts are optional
  tools selected by task complexity.
