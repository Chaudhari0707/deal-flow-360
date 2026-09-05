# Session context: DF-41, DF-42, DF-43

Load this file before continuing warehouse override, PDF layout, warehouse/restock, or
fulfillment-dialog work. It is the handoff for later sessions. Linear issues remain the task
contract; this file records what landed in the tree, what is still open, and what not to redo.

Do not treat this as approved architecture. Durable inventory rules live in
[`docs/architecture/inventory.md`](../architecture/inventory.md). Durable billing rules live in
[`docs/architecture/billing.md`](../architecture/billing.md).

**Do not commit, push, or change Linear status unless the user asks.** Do not recreate the reverted
ledger-desk UI. Do not write `.env.local`; this machine uses `.env` only. Never paste secrets.

---

## Branch handoff

- Branch: `agent/DF-41-override-pdf-restock` (from `dev`, not Linear’s suggested `mitvavir/df-41-…`)
- Tip SHA: uncommitted working tree on `dev` at `b3778db`
- PR: none
- Linear: [DF-41](https://linear.app/odoohack/issue/DF-41), [DF-42](https://linear.app/odoohack/issue/DF-42), [DF-43](https://linear.app/odoohack/issue/DF-43) — **In Progress**, assignee Mitva Virvadiya. Do not mark Done until acceptance is exercised in a browser.
- Completed: server/helpers/UI for the three tickets (picker override, PDF layout split, warehouse/restock helpers). Unit + inventory integration regressions exist.
- Remaining: browser/PDF/socket acceptance for DF-41/42/43, optional DF-42 line-column completeness. Dialog/AAA follow-up is implemented in this tree (verify in browser).
- Checks last run (implementation session): `bun run check:quick` surfaces (fmt/lint/typecheck/file-size) passed; 18 unit tests passed; 8 inventory integration tests passed. `bun run check` (full build + Playwright) was not the last recorded gate.
- Platforms: local macOS + Docker Postgres only. Browser, PDF viewer, two-window stock socket, and WCAG AAA **not** verified.
- Dirty files: see [Working tree](#working-tree) below. This session file is new.
- Next action: fix fulfillment/override dialogs (compact one viewport, content-only scroll, sticky `DialogFooter`, full-width quantity error, AAA contrast), then re-verify in the browser as Ops.

---

## How a later session should start

1. Stay on `agent/DF-41-override-pdf-restock`. Do not switch to `agent/ui-ledger-desk` (deleted) and do not start from a fresh Linear branch name.
2. Read DF-41, DF-42, DF-43 in Linear (acceptance checkboxes are still unchecked).
3. Read this file, then only the playbooks you touch: `.agents/coordination.md`, `.agents/shadcn.md`, `.agents/frontend.md`, `.agents/testing.md`. For dialog work also load the `better-accessibility` and `better-colors` skills, and the shadcn MCP (`search` blocks → view native dialog → do not hand-roll a second primitive unless composition fails).
4. Inspect the dirty files; do not discard unrelated contributor work.
5. Dialog/AAA/math follow-up is in the working tree: compact fulfillment dialog, `DialogBody` scroll, official base-nova footer (not sticky overlay), full-width override errors, destructive/popover contrast tokens. Verify in the browser (light and dark) as Ops before new feature scope.

---

## Linear contract (verbatim goals)

### DF-41 — Manual warehouse override (High, related DF-25)

Replace the flat product×warehouse grid with: pick warehouse → see available for that SKU → type qty
→ add more warehouses until allocated equals unshipped line demand (or leave remainder as backorder).

- Available = public `onHand - reserved` **plus this order’s unshipped reservation** at that warehouse.
- Same warehouse cannot be chosen twice on one product.
- Qty cannot exceed warehouse available or remaining line demand.
- Zero/removed rows release that allocation. Shipped units stay. Other orders stay protected.
- Confirmation still runs `planFulfillment`. This ticket is **override only**.
- API unchanged: `POST /api/v1/fulfillment/:id/override` with `{ allocations[{productId,warehouseId,quantity}], reason }`.
- Out of scope: planner, warehouse CRUD, PDF, invoices.

### DF-42 — Invoice and report PDF layout (Medium, related DF-32)

Keep numbers, snapshots, download routes, and auth. Change layout only.

- Routes: `GET /api/v1/invoices/:id/pdf` and report export `format=pdf`.
- Desired: header (mark, type, number, dates), bill-to/source block, line table, totals block, page-break safety.
- Ticket asked for line columns SKU/name, qty, unit, discount, tax, amount. Implementation currently draws **Description, Qty, Unit price, Total** because `InvoiceDocument.lines` has no per-line discount/tax.
- StandardFonts Helvetica + `printable()` for non-ASCII (`[U+…. ]`). Do not add a Unicode font unless tested.
- Out of scope: new PDF types, email attachments, due-date/tax math.

### DF-43 — Admin warehouse/stock CRUD + live restock (Medium, related DF-27, **blockedBy DF-23**)

Admin create/edit warehouses (max 3 **active**), restock including sold-out SKUs, fulfillment updates via `useStockFeed` without reload. Ops then **Consolidate remaining backorder**. Do not auto-reserve, auto-consolidate, or auto-ship.

- DF-23 still wants `/inventory` removed and controls relocated. That issue has **not** landed. Work stays on `/inventory` until DF-23 moves it.
- Out of scope: auto purchasing from replenishment threshold, planner math, invoice creation.

---

## What landed in code

### DF-41 override picker

| Path | Role |
| --- | --- |
| `src/features/inventory/override-form.tsx` | Nested dialog: warehouse `Select`, available only after pick, `NumberInput`, add/remove rows, required reason, existing override POST |
| `src/features/inventory/override-form-state.ts` | Pure helpers: seed rows, available math, remaining demand, errors, payload filter |
| `src/features/inventory/override.ts` | Existing `validateOverride` (unchanged contract) |
| `src/features/inventory/fulfillment-detail.tsx` | Hosts `OverrideForm`; compact dialog wrapper for list → detail |
| `test/unit/inventory-override.regression.test.ts` | Server + client helper regressions |

Helpers that later UI work must keep:

- `warehouseAvailable` = `(onHand - reserved) + this order’s unshipped qty` at that warehouse; `0` until a warehouse is chosen.
- `remainingForRow` excludes the current row so max qty is `min(available, unshippedDemand - otherRows)`.
- `allocatedQuantity` sums only safe positive integers. Empty/zero rows are omitted by `overrideAllocations`.
- `defaultOverrideRows` keeps unshipped allocations, starts an empty picker when demand remains, skips fully shipped lines.

### DF-42 PDF layout

| Path | Role |
| --- | --- |
| `src/features/billing/documents.ts` | Re-exports `invoicePdf` / `reportPdf`; Excel report unchanged |
| `src/features/billing/invoice-pdf.ts` | A4 portrait invoice/credit note: brand bar, identity, table, totals, footers |
| `src/features/billing/report-pdf.ts` | Landscape report table + sales metrics |
| `src/features/billing/pdf-layout.ts` | Shared draw/wrap/page-break helpers, StandardFonts, `printable` |
| `src/features/billing/_types/pdf.ts` | `PdfDoc` / `PdfColumn` |
| `src/features/billing/_types/documents.ts` | Optional `subtotalCents` / `taxCents` / `sourceNumber` |
| `src/features/billing/routes.ts` | Still `invoicePdf` / `reportPdf` from `documents.ts` |
| `test/unit/billing-documents.test.ts` | PDF magic, titles, wrap width, multi-page invoices/reports |

### DF-43 warehouse + restock

| Path | Role |
| --- | --- |
| `src/features/inventory/warehouse-limits.ts` | `ACTIVE_WAREHOUSE_LIMIT = 3` and shared 409 copy |
| `src/features/inventory/warehouse.ts` | Server uses the same helper |
| `src/features/inventory/warehouse-settings.tsx` | UI blocks activating a fourth; copy explains pause-first |
| `src/features/inventory/restock-locations.ts` | SKU → warehouse rows with `available = onHand - reserved` |
| `src/features/inventory/restock-form.tsx` | `RestockDialog` (sold-out copy) + `BackorderRestock` from fulfillment |
| `src/features/inventory/inventory-screen.tsx` | Admin warehouse/stock + restock; `useStockFeed` badge |
| `src/features/inventory/use-stock-feed.ts` | Already revalidates `/api/v1/inventory`, `/api/v1/fulfillment`, `/api/v1/workspace` |
| `test/unit/inventory-warehouse.test.ts` | Fourth-active + sold-out restock locations |
| `test/integration/inventory.regression.test.ts` | Sold-out restock does not auto-consolidate; fourth active blocked |

`useStockFeed` was **not** rewritten. Socket already existed; DF-43 wired restock/fulfillment to the same mutate keys.

---

## Working tree

Modified:

- `src/features/billing/_types/documents.ts`
- `src/features/billing/documents.ts`
- `src/features/billing/routes.ts`
- `src/features/inventory/fulfillment-detail.tsx`
- `src/features/inventory/inventory-screen.tsx`
- `src/features/inventory/override-form.tsx`
- `src/features/inventory/restock-form.tsx`
- `src/features/inventory/routes.ts`
- `src/features/inventory/warehouse-settings.tsx`
- `src/features/inventory/warehouse.ts`
- `test/integration/inventory.regression.test.ts`
- `test/unit/billing-documents.test.ts`
- `test/unit/inventory-override.regression.test.ts`

Untracked (new):

- `src/features/billing/_types/pdf.ts`
- `src/features/billing/invoice-pdf.ts`
- `src/features/billing/pdf-layout.ts`
- `src/features/billing/report-pdf.ts`
- `src/features/inventory/override-form-state.ts`
- `src/features/inventory/restock-locations.ts`
- `src/features/inventory/warehouse-limits.ts`
- `test/unit/inventory-warehouse.test.ts`
- `docs/engineering/session-df-41-42-43.md` (this file)

---

## Confirm → fulfillment → invoice (product recap)

Keep this straight when testing override/restock:

1. Customer/rep **confirm** is atomic: order + `planFulfillment` reserve + billing. Shortage becomes **backorder**. Unavailable qty is still billed.
2. Invoices are created at confirm (one-time net14 includes backordered lines; recurring is separate and due at issue). Shipment does **not** create the invoice.
3. Ops **Accept shipment** is a state change only. It does not reserve again. Do not mention
   warehouse “split” in the UI; reservation at confirm is automatic.
4. **Manual override** replaces this order’s unshipped reservations only.
5. **Restock** increases on-hand. It does **not** fill backorder.
6. **Consolidate remaining backorder** is the PDF B6 prompt (API `POST /fulfillment/:id/consolidate`).
   Ops-only. It checks remaining product demand against available stock at each active warehouse
   (`onHand - reserved`) and reserves what that warehouse can cover. Restock is not on this dialog;
   Admin receives stock on Inventory. It does not ship. A retry with nothing remaining is a no-op;
   no available stock returns a conflict. The dialog shows units still needed and per-warehouse
   available qty.
7. **Ship** reduces on-hand and reserved together per reservation.

`available = onHand - reserved`. PostgreSQL enforces `onHand >= reserved >= 0`.

---

## Signup, auth, and local runtime (do not re-litigate)

- Public `/signup` is **sales-rep only**. There is no role picker. Missing profile defaults to `rep` in `src/server/access.ts` (`role: profile?.role ?? "rep"`). Manager/finance/ops/admin/customer are seeded or assigned, not self-serve.
- Demo login email used in a prior session: `admin@dealflow360.demo`. Password lives only in ignored env. Do not paste it.
- This operator uses **`.env`**, not `.env.local`. `docs/engineering/local-runtime.md` still mentions `.env.local`; do not create that file here.
- Local Postgres is Docker Compose `local_postgres` at `/Users/mitvavirvadiya/Developer/Docker/DB/docker-compose.yml`, published `5432`, database `deal_flow_360_dev`. If login fails with `ECONNREFUSED 127.0.0.1:5432` or `28P01`, the container is down or not publishing ports — recreate **postgres only**, do not rewrite credentials into chat.
- App: `http://127.0.0.1:3000`, stock socket port = app port + 101 (`3101`). Stay on one hostname (`127.0.0.1` vs `localhost`) per browser session.

---

## UI experiment (reverted — do not restore)

Branch `agent/ui-ledger-desk` was hard-reset, cleaned, and **deleted locally**. It was never on origin. Do not reintroduce Tally/ledger/IBM Plex/DF-plate/no-scroll-desktop work unless a new Linear issue asks for it.

---

## Remaining work (priority)

The last user request before this file: fulfillment item dialogs must be compact, scroll correctly, keep the reason field visible, use a real sticky footer, meet WCAG AAA in light and dark, and show the quantity error at full card width. Check **every** dialog footer, not only fulfillment. Prefer rewriting `src/components/ui/dialog.tsx` from current shadcn `base-nova` source if composition cannot stop the overlay.

### Observed bugs (screenshots, not yet fixed)

1. Opening a fulfillment row uses `FulfillmentDetailDialog` (`sm:max-w-4xl`) wrapping compact `FulfillmentDetail` plus a footer that only has **Close**. Accept / Override / Consolidate / Ship live **inside the card body**, so the dialog is tall and the footer fights the body.
2. `DialogContent` is `overflow-y-auto` on the **whole popup**. `DialogFooter` is `sticky bottom-0 z-10 -mx-4 -mb-4 … bg-muted/95`. Sticky footer therefore overlays the last fields (reason, quantity). Close visually overlaps content.
3. Nested `OverrideForm` is a second dialog (`sm:max-w-lg`) with `sm:grid-cols-[minmax(0,1fr)_7rem_auto]`. Quantity `FieldError` wraps inside a **7rem** column. User asked the message to span the **whole card width**.
4. Display bug: legend showed **Allocated 261** vs **Demanded 50** while qty 261 vs Available 40. Server demand for that Harbor-like line is 50 (24 allocated + 26 backorder). `allocatedQuantity` is summing the watched NumberInput value, so 261 is a **client state / NumberInput** problem, not real reserved stock. Fix the form state; do not change server demand math to match 261.
5. Contrast: mint `--primary` NumberInput plus destructive error on popover failed AAA in dark (and likely light). Follow `better-colors` + theme tokens; do not one-off hex.
6. Reason input clipped behind the nested-dialog footer.

### Intended dialog fix (do this next)

- Compact the fulfillment dialog toward one viewport when content fits. If it cannot, **only the body** scrolls; header and `DialogFooter` stay put.
- Put primary actions in `DialogFooter` where that matches shadcn (Close + relevant actions). Do not leave Close as the only footer action while Accept/Override sit under a scrolling table unless a second nested dialog is the override surface.
- Quantity error: break the 7rem column so `FieldError` is full width under the row (or move error below the grid).
- Clamp/display allocated qty from safe integers bounded by unshipped demand; never show 261 against demand 50.
- Audit every `DialogFooter` consumer: `override-form.tsx`, `fulfillment-detail.tsx`, `restock-form.tsx`, `warehouse-settings.tsx`, `stock-setup.tsx`, `invoice-workspace.tsx`, `subscription-workspace.tsx`, `catalog-editor.tsx`, `command.tsx`. Alert dialogs already use `AlertDialogFooter`.
- Primitive: `components.json` style is `base-nova`. Current `src/components/ui/dialog.tsx` is Base UI (`@base-ui/react/dialog`), not Radix. shadcn MCP search for “sticky footer” returned no block in a prior session; search native dialog + examples before editing the primitive. `.agents/shadcn.md`: do not edit generated primitives for a single screen if a feature wrapper suffices; here the overflow-on-popup is shared, so a primitive fix is in scope if all dialogs share the clip.

### DF-42 leftover

- Visual check of one-time invoice, subscription invoice, and one sales report PDF — **not done**.
- Line table does not include discount/tax columns (data model has no per-line fields). Totals do include subtotal, tax (if present), payments, credits, outstanding.
- Do not change download auth.

### DF-43 leftover

- Two-window live socket: restock in one window, fulfillment in another updates without refresh — **not done**.
- Browser: create warehouse, fourth-active blocked, restock sold-out SKU, consolidate — **not done**.
- If DF-23 lands, move warehouse/stock/restock off `/inventory` instead of adding a second admin surface.

### DF-41 leftover

- Browser as Ops: two warehouses, fill to line qty, save, allocations match — **not done**.
- Playwright `playwright/e2e/inventory.spec.ts` was named in the ticket; no new e2e was added in this work.

---

## “Consolidate remaining backorder”

Ops-only button on the fulfillment backorder alert (`fulfillment-detail.tsx`). Calls `POST /api/v1/fulfillment/:id/consolidate`.

It is **not**: restock, accept, ship, or a second confirm. After Admin/Ops receive stock, this fills leftover unreserved demand from now-available warehouses. Other orders’ reservations stay protected. If nothing remaining can be reserved, a retry is a no-op.

Copy/footer work should make that obvious in the dialog, not rename the API.

---

## Tests to run after dialog/math fixes

Focused, in order:

```bash
bun test test/unit/inventory-override.regression.test.ts test/unit/inventory-warehouse.test.ts test/unit/billing-documents.test.ts
bun test test/integration/inventory.regression.test.ts
bun run check:quick
```

Before claiming the three tickets done (buildable tree): `bun run check`. Do not weaken a check to go green.

Add a unit case if the 261 allocated display is a helper bug (non-integer / out-of-range watched values must not inflate the legend).

---

## Agent notes from the implementation session

- Three worktree subagents implemented the tickets in parallel, then changes were merged into this branch. Subagent ids (historical): DF-41 `01a072fe-372d-7dc0-957b-d8a2369d83b6`, DF-42 `…d8b133581358`, DF-43 `…d8cc6dac728f`.
- A prior Linear pass briefly assigned the whole open board to Mitva, then unassigned everything except DF-41/42/43. Do not mass-assign again.
- Signup question is settled: sales-rep only.

---

## Pointers

| Need | Where |
| --- | --- |
| Inventory ledger rules | `docs/architecture/inventory.md` |
| Billing / invoices | `docs/architecture/billing.md` |
| Local run | `docs/engineering/local-runtime.md` (ignore `.env.local` instruction on this machine) |
| Dialog footer rule | `.agents/shadcn.md` |
| Coordination / Linear | `.agents/coordination.md` |
| Product PDF (signup is internal) | `docs/product/DealFlow360.pdf` |
