# shadcn/ui

- `components.json`, `src/app/globals.css`, aliases, and `src/lib/utils.ts` are canonical.
- Before UI implementation, use the shadcn MCP in this order: search relevant **blocks**, view the
  best block and its dependencies, search/view the underlying native components and examples, then
  request the add command. Do not skip directly to hand-written lookalikes.
- Add only the required components with the pinned `bun run shadcn -- add <component>` command and
  review generated source before use.
- Normalize generated class composition to the shared `@/lib/utils` `cn` helper. Do not retain a
  second class-merging helper/package.
- Shared primitives live under `src/components/ui`; feature composition stays near the owning feature.
- Preserve semantic HTML, keyboard operation, focus visibility, accessible names, and status/error
  announcements when adapting generated components.
- Use theme tokens rather than one-off colors and the shared `cn` helper for class composition.
- Do not edit generated primitives for a single screen when composition or a feature wrapper suffices.
- Give submit buttons `type="submit"`; Base UI buttons otherwise use button behavior. Set
  `nativeButton={false}` when a Button renders a link. Preserve real disabled behavior for links.
- Prefer composition from the inspected block and existing primitives. Extract shared behavior only
  after a repeated use case proves the abstraction; do not duplicate component variants per screen.
