# DealFlow360 editorial design language

```text
status: current
scope: every UI surface under src/app, src/components, src/features
gate: WCAG AAA in light AND dark (7:1 body, 4.5:1 large text, 3:1 UI boundaries)
method: dependency-graph port, bottom-up by layer
```

## 1. Intent

A modern editorial enterprise interface. Hierarchy comes from **layout, spacing, alignment,
rules, proportion and type scale** — never from cards, pills, shadows or low-contrast text.
The product must not read as shadcn, a Tailwind admin template, or a generic SaaS dashboard.
Component libraries stay underneath for behaviour and accessibility; their appearance does not.

## 2. The AAA constraint changes the design, not just the palette

Measured on the pre-overhaul build, every text node on 13 routes in both themes:
**97 violations, 41 distinct.** The opacity ladder against the light page ground:

| Utility | Light | Dark |
| --- | --- | --- |
| `text-foreground/90` | 13.26:1 | 12.39:1 |
| `text-foreground/75` | 7.83:1 | 8.84:1 |
| `text-foreground/70` | 6.55:1 ✗ | 7.82:1 |
| `text-foreground/60` | 4.65:1 ✗ | 6.02:1 ✗ |
| `text-foreground/45` | 2.92:1 ✗ | 3.89:1 ✗ |

**Therefore: opacity is not a hierarchy device.** Nothing below `/75` passes in light.
Quiet labels get their quietness from **size, weight, letter-spacing and case**, and from a
single AAA-verified `--muted-foreground` — never from transparency.

This is also the brief's own instruction: "typography hierarchy through size, weight, spacing,
alignment, and case".

## 3. Token contract

Solved numerically, not chosen by eye. Every value below is the measured AAA floor or better.

| Role | Light | Dark | Checked against |
| --- | --- | --- | --- |
| quiet/label ink | `oklch(0.4500 0 0)` | `oklch(0.7600 0 0)` | page, muted and popover grounds |
| accent as **text** | `oklch(0.4377 0.12 160.9)` | `oklch(0.6839 0.13 160.9)` | page ground |
| risk/overdue ink | `oklch(0.4810 0.19 29)` | `oklch(0.7178 0.16 29)` | page ground |
| settled/positive ink | `oklch(0.4371 0.12 162)` | `oklch(0.6838 0.13 162)` | page ground |
| focus ring | `oklch(0.5357 0.15 160.9)` | existing `oklch(0.8003 …)` | page ground, 3:1 min |
| input boundary | `oklch(0.6628 0 0)` | `oklch(0.4907 0 0)` | page ground, 3:1 min |

Rules that follow from the measurements:

- `--primary` and `--destructive` are **fills, not inks**. As text they measure 1.54:1 and
  2.50:1. Use the accent/risk inks above for coloured text; use the fills only behind
  `*-foreground`.
- Dark `--destructive-foreground` must be near-black. The current pairing measures **1.56:1**
  — unreadable — because dev-v2 lightened the fill without flipping the text.
- `--radius` drops to a subtle value; geometry is square or nearly so. No pills.
- Global body `letter-spacing` returns to `0`. Tracking belongs to eyebrow labels only, where
  it is a deliberate signal rather than a tax on every line of dense data.
- Shadows are not a separator. Thin rules are.

## 4. Composition rules

- **Not card-first.** A container appears only when the content genuinely needs one. Prefer
  section rules, hairline-divided columns, background shifts and spacing.
- **Figures over tiles.** Summary numbers sit in a hairline-divided band, tabular and aligned
  for comparison — not in a grid of bordered cards.
- **State is a marker plus text**, not a coloured pill. Semantic colour is reserved for real
  states (risk, overdue, failure, success).
- **Tables** carry no outer box. Letterspaced uppercase headers over a single rule, hairline
  row rhythm, right-aligned tabular numerals, restrained hover, minimal chrome.
- **Icons are rare.** Typography and spacing carry hierarchy; navigation stays quiet.
- **Density is not uniform.** Summaries breathe; registers and operational tables compact.
- **Motion** is subtle, fast and explanatory only.

## 5. Port order (measured dependency graph)

128 UI modules, 14 layers. Re-skinning a screen before its primitives is rework, and any
arbitrary-variant override (`[&_[data-slot=button]]:…`) written at screen level is a
descendant selector `twMerge` cannot later merge away — it becomes a permanent pin.

```
L0  globals.css                                  tokens — reaches all 128
L1  button(49) alert(24) card(22) badge(18)      primitives
    input(18) separator(10) select(9) table(4)
L2  field(17) dialog(8) number-input(9)          composed primitives
    alert-dialog(4) sidebar-menu
L3  data-table/* sidebar command
L4  data-table.tsx workspace-shell *-columns     shared compositions
L10 workspace-state(25) auth-form portal/*       fallback + forms
L11 protected-surface(12) dashboard              screens
    catalog-editor report-workspace quote-editor
L12 catalog invoice-workspace quote-detail
    settings health subscriptions
L13 route pages
```

`workspace-state.tsx` is L2 by role, not L10: it is the fallback for `protected-surface`,
`app/loading.tsx` and `app/error.tsx`. Until it is ported, every route flashes the old card
grid before content arrives.

`card.tsx`, `dialog.tsx` and `alert-dialog.tsx` hardcode `ring-foreground/10` rather than
`--border`, so no token edit reaches their edges. They need file edits.

## 6. Invariants — do not break

Verified against the specs. A visual re-skin must preserve all of these.

- **Search placeholders** are asserted exactly on 7 routes (`filter-panels.spec.ts`), and the
  same file asserts **no `Show filters` / `Hide filters` button exists** on any of them. The
  collapsible filter pattern must not spread to those routes.
- The shared toolbar derives the search input's **accessible name** from `searchLabel ??
  searchPlaceholder`. Any screen replacing the toolbar must supply both deliberately.
- **Dialog accessible names** come from `DialogTitle` text; `billing.spec` opens dialogs by
  the invoice number alone.
- `[data-slot='dialog-footer']` / `[data-slot='alert-dialog-footer']` must remain
  `position: sticky`, per `.agents/shadcn.md`: only dialog content may scroll, so actions stay
  reachable. Long content belongs in `DialogBody` / `AlertDialogBody`.
- `quote-editor.tsx`'s `role="note"` tier text is asserted verbatim by `customers.spec.ts`.
  Restyle it; do not reword it.
- Route `h1` text is asserted by `role-access.spec.ts`, including `403 — Access denied`.
- Success and error copy after mutations is asserted verbatim.
- `data-table.regression.test.ts` locks the literal strings `overflow-visible`,
  `border-separate` and `group/table-row`.

## 7. Repository constraints

- 500 lines per source file (`check-file-size.ts` counts one more than `wc -l`;
  `quote-editor.tsx` has 5 lines of headroom).
- No exported types outside `_types/`; keys sorted alphabetically there.
- `@/` imports only; canonical Tailwind spacing classes; `cn` from `@/lib/utils`.
- Every dialog action cluster uses the shared `DialogFooter` / `AlertDialogFooter`.

## 8. Verification

Three gates, run before and after every wave:

1. `bun run check:quick` — format, lint, types, file size, instruction routing.
2. `bun run test:e2e` — differential against a recorded baseline; any **new** failure is a
   regression.
3. The runtime AAA audit — every text node, every route, both themes. Target **0**.
