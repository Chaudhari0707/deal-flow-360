# Component Rules

Read `.agents/shadcn.md`, `.agents/data-table.md`, and `.agents/frontend.md` as relevant.

- Search shadcn blocks through MCP before selecting primitives or writing a new shared component.
- Native generated primitives stay in `src/components/ui`; feature composition stays with its owner.
- Use the shared DataTable for application list screens and `AppProviders` for SWR/tooltip context.
- Reuse `cn` from `@/lib/utils`; do not introduce another class-merging helper.
