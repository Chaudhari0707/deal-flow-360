# Invoice manual test matrix (Finance)

Use after `bun run local` with `DEMO_PASSWORD` set so the invoice status seed runs.
Sign in as **`finance@dealflow360.demo`**. Open **Invoices**.

Search the register for numbers starting with **`INV-SEED-`**.

## Seed fixtures (what you should see)

| Invoice number | Kind | Status | What it proves |
| --- | --- | --- | --- |
| `INV-SEED-UNPAID` | One-time | **UNPAID** | Normal open balance; payment control visible |
| `INV-SEED-OVERDUE` | One-time | **UNPAID** (due in the past) | Overdue unpaid; Deal Health overdue signal |
| `INV-SEED-PAID` | One-time | **PAID** | Cash payment ledger + no pay button |
| `INV-SEED-FREE` | One-time | **PAID** ($0) | Fully discounted / free settles with **no** payment row |
| `INV-SEED-HYBRID-OT` | One-time | **UNPAID** | Same order as recurring, **separate** invoice |
| `INV-SEED-HYBRID-RC` | Recurring | **UNPAID** | Same order as one-time, **separate** invoice |
| `INV-SEED-CREDIT-OPEN` | One-time | **UNPAID** | Partial credit applied; balance still owed |
| `INV-SEED-CREDIT-SET` | One-time | **PAID** | Settled by credit only (`paid = 0`) |
| `INV-SEED-CREDIT-BANK` | One-time | **PAID** | Cash paid + leftover **available customer credit** |
| `INV-SEED-ADJUST` | Adjustment | **UNPAID** | Mid-cycle prorated increase invoice |

Also still present from the base demo:

| Source | Notes |
| --- | --- |
| Orion (`Q-1026`) invoices | Paid hybrid (setup + yearly care) |
| Harbor / Northwind confirmed orders | Extra unpaid one-time / recurring from original seed |

---

## Edge cases by status / kind

### UNPAID (`INV-SEED-UNPAID`)

1. Open it. Outstanding equals total. **Record full payment** is shown.
2. Enter reference shorter than 3 chars → field error; button path blocked.
3. Enter `BANK-TEST-1` and record payment → status **PAID**, outstanding `$0`, payment alert appears.
4. Retry the same logical payment (double-submit / refresh) → no second payment / no double balance.
5. Download PDF → header, bill-to, line table, totals, status readable; amounts match UI to the cent.

### OVERDUE UNPAID (`INV-SEED-OVERDUE`)

1. Confirm due date is in the past and status is still **UNPAID**.
2. Open **Customer health** as manager (or finance if visible) → overdue unpaid invoice signal links here.
3. Pay it as Finance → overdue signal clears after refresh.
4. Download PDF → due date still shown; status becomes PAID after payment.

### PAID with cash (`INV-SEED-PAID`)

1. No **Record full payment** button.
2. Payment reference `SEED-BANK-PAID` visible.
3. PDF downloads; shows PAID / payments / zero outstanding.
4. Direct pay API retry with a new key on a zero-balance invoice → rejected (no outstanding).

### FREE / $0 PAID (`INV-SEED-FREE`)

1. Total `$0.00`, status **PAID**, **no** payment ledger row invented.
2. PDF still downloads and remains commercially readable.
3. Does not appear as an actionable unpaid balance in Outstanding total.

### Hybrid separate invoices (`INV-SEED-HYBRID-OT` + `INV-SEED-HYBRID-RC`)

PDF requirement: one-time and recurring on the **same order** are billed **separately**.

1. Both numbers share order `SO-INV-HYBRID` / quote `Q-INV-HYBRID`.
2. One-time lines only on `…-OT`; recurring period on `…-RC`.
3. Paying only the one-time leaves recurring unpaid (and the reverse).
4. Download both PDFs → different document kinds / schedules, correct line snapshots.

### Partial credit still UNPAID (`INV-SEED-CREDIT-OPEN` + `CN-SEED-OPEN`)

1. Applied credits > 0, outstanding > 0, status **UNPAID**.
2. Pay remaining balance → PAID; credits + payments never exceed total.
3. PDF / detail shows applied credits and remaining outstanding before payment.

### Settled by credit only (`INV-SEED-CREDIT-SET` + `CN-SEED-SET`)

1. Status **PAID**, `paid = $0`, full amount in applied credits.
2. No cash payment row.
3. Copy/PDF must not imply a bank refund happened (credit note ≠ cash refund).

### Available leftover credit (`INV-SEED-CREDIT-BANK` + `CN-SEED-BANK`)

1. Invoice PAID by cash.
2. Credit shows **available** (amount 25.00, applied 0).
3. Confirm top **Customer credit** card includes this leftover.
4. Confirm it is **not** auto-applied to `INV-SEED-UNPAID` or other invoices (hackathon boundary).

### ADJUSTMENT (`INV-SEED-ADJUST`)

1. Kind displays as adjustment; linked to hybrid subscription/order.
2. UNPAID and payable like a normal invoice.
3. PDF title/kind distinguishes adjustment from period recurring charge.

---

## Live actions (not pre-seeded — do these on hybrid subscription)

These cover PDF subscription billing / cancel / proration rules:

1. Open **Subscriptions**, find Care Plan from `SO-INV-HYBRID`.
2. **Change quantity** mid-period → inspect new prorated **ADJUSTMENT** invoice or credit.
3. **Cancel** with reason → future billing stops; unused billed service creates a **credit note**; issued invoices remain.
4. **Run due billing** twice → no duplicate period invoices (idempotent).

---

## Reports + PDF export (PDF deliverable)

1. **Reports** as Finance/Manager: filter PAID vs UNPAID; confirm seed invoices appear in the right bucket.
2. Filter by customer / period covering the seed created dates.
3. Export **PDF** and **XLSX** → net billed / collected / outstanding stay consistent with the invoice register.
4. Invoice PDF auth: Finance can download; Ops cannot; Rep only for own quotes; customer only own invoices.

---

## Role / security edges (PDF roles)

| Actor | Expect |
| --- | --- |
| Finance | Pay, download, subscription change/cancel, reports |
| Ops | No invoice pay / no finance mutations (403) |
| Admin | Reports/catalog; warehouse on Inventory; not a substitute Finance cashier unless granted |
| Customer | Own portal only; cannot open another customer’s invoice by URL |

---

## PDF problem-statement coverage map

| PDF expectation | Covered by |
| --- | --- |
| Hybrid one-time + recurring on one order | `INV-SEED-HYBRID-OT` / `RC` |
| Billed correctly and separately | Same + pay one without the other |
| Record payment → invoice status updates | `INV-SEED-UNPAID` → PAID |
| Recurring billing schedule / proration | Hybrid subscription + live change |
| Cancel → partial refund **or credit note** | Live cancel (product uses **credit notes**, not cash refunds) |
| Finance reconciles recurring billing and credits | Credit fixtures + subscription cancel |
| Invoice PDF download | Every `INV-SEED-*` download check |
| Reporting filters + PDF/XLS export | Reports section above |

---

## Pass bar

- Every `INV-SEED-*` row is findable and matches the table above.
- Paying `INV-SEED-UNPAID` flips to PAID with matching PDF totals.
- Hybrid stays two documents on one order.
- Credits never invent cash refunds; leftover credit does not silently pay another invoice.
- Due billing and payment retries stay idempotent.
