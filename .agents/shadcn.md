# shadcn/ui

- `components.json`, `src/app/globals.css`, aliases, and `src/lib/utils.ts` are canonical.
- Add components with `bun run shadcn -- add <component>` and review generated source before use.
- Shared primitives live under `src/components/ui`; feature composition stays near the owning feature.
- Preserve semantic HTML, keyboard operation, focus visibility, accessible names, and status/error
  announcements when adapting generated components.
- Use theme tokens rather than one-off colors and the shared `cn` helper for class composition.
- Do not edit generated primitives for a single screen when composition or a feature wrapper suffices.
