# Local Lint Rules

- Keep every rule deterministic, side-effect free, and covered by a focused fixture/test when changed.
- Diagnostics MUST explain the safer replacement, not only identify the violation.
- Rule changes require rebuilding with `bun run build:rules` and running `bun run lint`.
- Do not weaken a rule for one feature; use a narrow, documented override only when the general rule
  is genuinely incorrect.
