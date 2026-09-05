
# DealFlow360 — flow, phases, and tickets

Stack-agnostic working doc. Use this to cut tickets for **four people**. No frontend/backend framework choices here — only the product flow, who does what, and what “done” looks like.

On approval this file should also live in the repo as `docs/WORKFLOW.md` so the team can generate tickets from it.

Sources:

- Spec PDF: `/Users/mitvavirvadiya/Downloads/DealFlow360.pdf`
- Mock: [DealFlow360 End to End Product Flow](https://app.excalidraw.com/l/65VNwvy7c4X/7Fb5SR3WKu2)

Out of this phase: multi-currency. Keep a single currency (USD) everywhere.

Must ship in this phase (not later):

- Customer **magic-link email** to open a live quotation
- **PDF invoice** download
- **Live quantity over sockets** (on-hand / reserved / available, backorder consolidate)

---

## How four people work

Shared contract first (Phase 0). Then four parallel tracks. Then a join phase so the tracks actually connect. Then demo hardening.

| Person                              | Track                                                                                                         | Owns                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **P1 — Identity & Portal**   | Auth, roles, customer portal, magic-link email, messages                                                      | Screens 1, 11                    |
| **P2 — Quote & Governance**  | Products, pricelists, quote builder, live discount limits, upsell, approval routing + audit                   | Screens 3, 4, 5, 6, 16, 17, 18   |
| **P3 — Stock & Fulfillment** | Warehouses, stock, socket qty, split planner, backorder consolidate                                           | Screens 7, 8                     |
| **P4 — Cash & Health**       | Subscriptions, hybrid billing, invoices, PDF, payments, credit notes, deal health, reports, dashboard widgets | Screens 2, 9, 10, 12, 13, 14, 15 |

Nobody fakes another track’s rules. If P2 needs a risk score, they implement the formula. If P3 needs a split, they implement the planner. If P4 needs proration, they implement it. UI without the rule is not done.

---

## Screen map (mock)

Internal app: one highlighted tab per module. Pattern is always **list → click row → detail**.

Customer portal is a **different shell**: My Quotation / Messages / Profile. Not the internal tabs.

| #  | Screen                           | Opens from                                                                         |
| -- | -------------------------------- | ---------------------------------------------------------------------------------- |
| 1  | Login / Signup                   | Entry. Internal → dashboard. Customer → portal                                   |
| 2  | Sales Dashboard                  | Hub: pending approvals, open quotes, at-risk deals, recent activity                |
| 3  | Quotations list (kanban + table) | Tab Quotations. Columns: Draft, Pending Approval, Approved, Negotiation, Confirmed |
| 4  | Quotation detail                 | Click a quote row. Lines, live limit, upsells, save/submit                         |
| 5  | Approvals list                   | Tab Approvals. Pending / Returned / Approved                                       |
| 6  | Approval detail                  | Click an approval row. Risk breakdown, stepper, audit, approve/return/reject       |
| 7  | Fulfillment + stock list         | Tab Fulfillment. Warehouse stock table + orders awaiting fulfillment               |
| 8  | Fulfillment detail               | Click an order. Suggested split, accept / override, consolidate backorder          |
| 9  | Subscriptions list               | Tab Subscriptions. Active / Paused / Cancelled                                     |
| 10 | Billing detail                   | Click a subscription. One-time lines vs recurring + schedule                       |
| 11 | Customer portal                  | Magic link or customer login. Negotiate / confirm                                  |
| 12 | Invoices list                    | Tab Invoices. Unpaid / Paid                                                        |
| 13 | Invoice detail                   | Click an invoice. Record payment, download PDF                                     |
| 14 | Deal Health                      | Tab Deal Health. Stalled, discount anomalies, delivery slippage                    |
| 15 | Admin reporting                  | Tab Reports. Filters + export                                                      |
| 16 | Product catalog                  | Tab Product                                                                        |
| 17 | Product + pricelist detail       | Click a product                                                                    |
| 18 | Discount tiers + approval chain  | Settings from backend                                                              |

---

## The actual workflow (one deal)

This is the spine. Every ticket should name which step it serves.

```
1. Admin has catalog, tiers, warehouses, plans, upsell rules (seeded + editable)
2. Rep logs in → Dashboard → New Quotation
3. Rep picks customer (tier + pricelist applied) and adds lines
4. Each discount is checked live against THAT line’s ceiling (tier ∩ category)
5. Upsell panel ranks add-ons with margin delta; Add updates totals immediately
6. Submit:
     if risk NONE → Approved (no human)
     if MEDIUM  → Sales Manager
     if HIGH    → Sales Manager then Finance
7. Approver sees why it was flagged, acts, audit row is written
8. Return sends quote back to Draft/Returned; resubmit re-enters the chain
9. Once approved, system emails the customer a magic link to Screen 11
10. Customer comments per line, counters a discount, or confirms
11. If the counter breaks a ceiling → quote re-enters approval automatically
12. On confirm:
      stockable one-time lines → fulfillment plan (split / backorder)
      recurring lines → subscription + billing schedule
      one-time invoice created (separate from recurring invoices)
13. Ops accepts or overrides the warehouse split; sockets push live qty
14. If restock lands on a backorder warehouse → “Consolidate Remaining Backorder”
15. Recurring invoices generate on cycle; cancel/modify prorates and may credit
16. Finance records payment; invoice goes Paid; PDF is downloadable
17. Deal Health watches stall / anomaly / slippage the whole time
18. Reports filter the same records (period, team, approval status, product)
```

### Quote status (kanban)

`DRAFT` → `PENDING_APPROVAL` → `APPROVED` → `SENT` → `UNDER_NEGOTIATION` → `CONFIRMED`

- `RETURNED` sits with Draft for the rep, and in Returned on the approvals list
- `REJECTED` is terminal for that version; rep must copy to a new draft if they continue
- Kanban “Negotiation” = `SENT` or `UNDER_NEGOTIATION`
- Confirm is blocked while approval is still required

### Roles

| Role          | Does                                                                |
| ------------- | ------------------------------------------------------------------- |
| Sales Rep     | Quotes, discounts, upsells, answers portal requests. Cannot approve |
| Sales Manager | First approval step, tier/chain config, deal health                 |
| Finance       | Second approval when HIGH, invoices, credit notes, payments         |
| Ops           | Splits, overrides, backorder consolidate                            |
| Admin         | Products, warehouses, plans, reports                                |
| Customer      | Portal only                                                         |

---

## Rules everyone must implement the same way

### Line ceiling

```
ceiling = min(customerTier.maxDiscountPct, category.maxDiscountPct)
overPoints = max(0, discountPct - ceiling)
```

Hardware 15%, Services 10%, Subscription 15% in seed. Gold 15%, Silver 10%, Bronze 5%.

### Blended risk → route

```
maxOver = max(overPoints on the quote)
sumOver = sum(overPoints)
```

| Condition                                   | Risk   | Who                  |
| ------------------------------------------- | ------ | -------------------- |
| maxOver = 0                                 | NONE   | Auto-approve         |
| maxOver > 0 and maxOver < 5 and sumOver < 8 | MEDIUM | Manager only         |
| maxOver ≥ 5 or sumOver ≥ 8                | HIGH   | Manager then Finance |

Spec example (must be a seed quote): Gold customer, Laptop 12% of 15% = OK, Setup Service 18% of 10% = +8pt → HIGH.

Live: Screen 4 shows `OK` or `OVER (+Npt)` as the discount is typed, not only on submit.

Every submit / approve / reject / return / resubmit / customer-counter writes audit: user, time, action, reason, risk snapshot.

### Warehouse split

For each stockable qty Q:

1. Prefer one warehouse that can cover Q. Tie-break: lower shipping weight, then more available.
2. Else fill from most-available warehouses; leftover is BACKORDER.
3. One shipment per warehouse used; cost = shippingWeight × shipments.

Ops can override but cannot allocate more than available. Available = onHand − reserved.

### Hybrid billing

- One-time lines → their own invoice on confirm
- Recurring lines → subscription + schedule; first recurring invoice at period start
- Same order, two invoice streams, never mixed on one PDF
- Mid-cycle qty change prorates remaining days
- Cancel unused days → credit note; future schedule rows die

### Live quantity (sockets)

Broadcast at least: `productId`, `warehouseId`, `onHand`, `reserved`, `available`.

Push when: quote line reserved, split accepted, override, shipment, restock, consolidate.

Screen 7 and Screen 8 must move without refresh. When a backordered warehouse’s available becomes > 0, show **Consolidate Remaining Backorder**.

### Magic-link email

On Approved → Sent, email the customer contact with a single-use (or rotating) token URL to Screen 11. Token identifies the quote, not an internal session. Customer can also sign in with email + password. Expired link can request a new one.

### PDF invoice

Screen 13 **Download Summary** produces a real PDF: invoice #, customer, line split (one-time or recurring), amounts, status, due date. Not a screenshot of the page.

---

## Seed data (make it wide enough to click around)

Password for every internal/customer login: `demo1234`. Magic-link path must also work for Acme without typing a password.

### Users

| Email                       | Name       | Role                                                                             |
| --------------------------- | ---------- | -------------------------------------------------------------------------------- |
| `rep@dealflow360.dev`     | J. Rao     | Sales Rep                                                                        |
| `rep2@dealflow360.dev`    | A. Chen    | Sales Rep (needed so discount-anomaly “vs this rep’s average” has a contrast) |
| `manager@dealflow360.dev` | M. Shah    | Sales Manager                                                                    |
| `finance@dealflow360.dev` | R. Iyer    | Finance                                                                          |
| `ops@dealflow360.dev`     | K. Patel   | Ops                                                                              |
| `admin@dealflow360.dev`   | Admin      | Admin                                                                            |
| `acme@dealflow360.dev`    | Priya Nair | Customer (Acme)                                                                  |
| `beta@dealflow360.dev`    | Liam Ortiz | Customer (Beta)                                                                  |
| `zenith@dealflow360.dev`  | Sofia Berg | Customer (Zenith)                                                                |

### Customers & tiers

| Customer        | Tier   | Notes                                                    |
| --------------- | ------ | -------------------------------------------------------- |
| Acme Corp       | Gold   | Hero deal Q-1042                                         |
| Beta Industries | Silver | Pending finance, portal counter already in flight        |
| Nova Retail     | Bronze | Auto-approved, clean deal                                |
| Zenith Co       | Gold   | Stalled 9 days, delivery slippage                        |
| Delta LLC       | Bronze | Discount anomaly 22% vs rep avg 8%, subscription paused  |
| Orion Ltd       | Gold   | Large confirmed, fully paid                              |
| Harbor Labs     | Silver | Mixed hardware + subscription, split across 3 warehouses |
| Northwind       | Bronze | Backorder waiting on East Depot restock                  |

### Catalog

Categories: Hardware, Services, Subscription.

| Product              | Category     | List    | Cost | Tax | Subscription? | Variants                            |
| -------------------- | ------------ | ------- | ---- | --- | ------------- | ----------------------------------- |
| Laptop Pro 14        | Hardware     | 1200    | 780  | 15% | no            | Size 13/14/16 (+0/+0/+80)           |
| Docking Station      | Hardware     | 180     | 95   | 15% | no            | Color Blue/Black/Silver (Black +30) |
| Wireless Mouse       | Hardware     | 40      | 12   | 15% | no            | —                                  |
| Onsite Setup Service | Services     | 450     | 320  | 10% | no            | —                                  |
| Extended Warranty    | Services     | 180     | 40   | 10% | no            | —                                  |
| Care Plan 1yr        | Subscription | 28/mo   | 8    | 0%  | monthly       | —                                  |
| Care Plan 2yr        | Subscription | 46/mo   | 10   | 0%  | monthly       | —                                  |
| Care Plan 3yr        | Subscription | 40/mo   | 9    | 0%  | monthly       | —                                  |
| Support SLA          | Subscription | 300/qtr | 90   | 0%  | quarterly     | —                                  |
| Monitoring Add-on    | Subscription | 15/mo   | 4    | 0%  | monthly       | —                                  |

Pricelists (USD only): Bronze = list, Silver = −5% on hardware, Gold = −10% on hardware. Services and subscriptions use list unless a line discount is applied.

### Discount policy (Screen 18)

Tier ceilings: Bronze 5 / Silver 10 / Gold 15.
Category ceilings: Hardware 15 / Services 10 / Subscription 15.
Chain: within limit → none; over + MEDIUM → Manager; over + HIGH → Manager then Finance.

### Warehouses & stock

Shipping weight: Main 1.0, East Depot 1.2, West Hub 1.4 (so planner prefers Main).

| Warehouse  | Product         | On hand       | Already reserved |
| ---------- | --------------- | ------------- | ---------------- |
| Main       | Laptop Pro 14   | 40            | 18               |
| East Depot | Laptop Pro 14   | 10            | 6                |
| West Hub   | Laptop Pro 14   | 4             | 0                |
| Main       | Docking Station | 65            | 12               |
| East Depot | Docking Station | 8             | 0                |
| Main       | Wireless Mouse  | 200           | 20               |
| East Depot | Onsite Setup    | n/a (service) | —               |

Laptop qty 24 on Acme should split 18 Main + 6 East (matches mock). A Harbor Labs line of 50 laptops should exhaust Main+East+West and backorder. Northwind 8 laptops reserved against East with East available 4 → backorder 4; a seeded “restock inbound” event lets sockets fire consolidate.

### Upsell pairings

- Laptop → Wireless Mouse (margin +18)
- Laptop → Docking Station (promo 12% off)
- Laptop → Care Plan 2yr (margin +46)
- Docking Station → Monitoring Add-on
- Setup Service → Extended Warranty

Min margin to surface a suggestion: 20%.

### Quotes (enough rows that every kanban column and every list filter is non-empty)

| ID     | Customer  | Status                          | Why it exists                                                                                                               |
| ------ | --------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Q-1042 | Acme      | **DRAFT**                 | Hero demo: Laptop×2 @12% OK, Setup @18% OVER, Warranty @10% OK. Submit → HIGH. Leave draft so the live demo does the work |
| Q-1041 | Acme      | APPROVED                        | Same shape, already approved, ready to send magic link if demo skips builder                                                |
| Q-1039 | Beta      | PENDING_APPROVAL (Finance step) | Manager already approved; finance queue. MEDIUM→HIGH after a portal counter is optional second path                        |
| Q-1035 | Nova      | APPROVED                        | Auto-approved LOW, shows “Auto-Approved / —” on Screen 5                                                                 |
| Q-1030 | Zenith    | SENT                            | Idle 9 days, promised date slipped → Deal Health stall + slippage                                                          |
| Q-1028 | Delta     | UNDER_NEGOTIATION               | 22% service discount; anomaly vs Rao’s 8% avg                                                                              |
| Q-1026 | Orion     | CONFIRMED                       | Paid, invoices exist                                                                                                        |
| Q-1024 | Harbor    | CONFIRMED                       | 50 laptops, 3-warehouse split + backorder                                                                                   |
| Q-1022 | Northwind | CONFIRMED                       | Backorder sitting on East Depot                                                                                             |
| Q-1020 | Beta      | RETURNED                        | Manager asked for justification (audit rows)                                                                                |
| Q-1018 | Nova      | REJECTED                        | So the approvals list is not only happy-path                                                                                |
| Q-1016 | Acme      | DRAFT                           | Tiny quote, no overage, to show auto-approve path quickly                                                                   |

### Approvals / audit already on disk

- Q-1042: none yet (demo writes them)
- Q-1039: Submitted (Rao) → Manager approved (Shah) → waiting Finance (Iyer)
- Q-1020: Submitted → Returned “need margin note”
- Q-1018: Submitted → Rejected “below floor”

### Subscriptions

| Customer | Plan              | Cycle     | Next bill | Status                  |
| -------- | ----------------- | --------- | --------- | ----------------------- |
| Acme     | Care Plan 2yr     | Monthly   | Sep 15    | Active                  |
| Beta     | Support SLA       | Quarterly | Nov 1     | Active                  |
| Delta    | Care Plan 1yr     | Monthly   | —        | Paused                  |
| Orion    | Care Plan 3yr     | Monthly   | Sep 1     | Active                  |
| Harbor   | Monitoring Add-on | Monthly   | Sep 8     | Active                  |
| Nova     | Care Plan 1yr     | Monthly   | —        | Cancelled + credit note |

### Invoices

| #          | Customer | Type                                          | Amount | Status  | Due                                 |
| ---------- | -------- | --------------------------------------------- | ------ | ------- | ----------------------------------- |
| INV-1042   | Acme     | One-time (from Q-1041 or post-confirm Q-1042) | 2730   | Unpaid  | Sep 10                              |
| INV-1043   | Acme     | Recurring Care Plan                           | 46     | Paid    | Sep 15                              |
| INV-1038   | Nova     | One-time                                      | 9750   | Paid    | Aug 30                              |
| INV-1031   | Zenith   | One-time                                      | 15300  | Unpaid  | Aug 20 (overdue → slippage/health) |
| INV-1027   | Orion    | One-time                                      | 41000  | Paid    | Aug 15                              |
| INV-1027-R | Orion    | Recurring                                     | 40     | Paid    | Sep 1                               |
| INV-1024   | Harbor   | One-time (partial, shipped portion only)      | 21600  | Unpaid  | Sep 12                              |
| CN-1004    | Nova     | Credit note from cancelled plan               | −14   | Applied | —                                  |

### Deal Health rows

- Zenith idle 9 days → Nudge already sent
- Delta discount 22% vs Rao avg 8% → Escalated to Manager
- Harbor delivery promise at risk (backorder)
- Northwind promise at risk (East Depot)
- Q-1030 promised date in the past

### Recent activity (Dashboard)

- Acme quotation approved by Finance
- Beta requested a discount change
- East Depot stock updated for Order #2291
- Magic link sent to Priya Nair (Acme)
- Credit note CN-1004 applied to Nova

---

## Phase 0 — shared contract (all four, half day)

Tickets (do together, then freeze):

- **T0.1 Status dictionary** — freeze quote, approval-step, fulfillment, subscription, invoice statuses and which screen they appear on.
- **T0.2 Event dictionary** — named events every track publishes/subscribes: `QuoteSubmitted`, `ApprovalActed`, `QuoteSent`, `CustomerCountered`, `QuoteConfirmed`, `StockChanged`, `SplitAccepted`, `InvoiceIssued`, `PaymentRecorded`, `NudgeSent`.
- **T0.3 Seed file** — load the tables above so every list is clickable before features are finished. Mark Q-1042 as the live demo quote.
- **T0.4 Role matrix** — which role can hit which action. Rep cannot approve. Customer cannot see internal nav. Magic-link token ≠ internal session.

Done when: a new teammate can read T0.1–T0.4 and not invent a fifth status.

---

## Phase 1 — four tracks in parallel

### P1 tickets — Identity & Portal

- **T1.1 Internal login / signup** — Screen 1. Email + password, basic validation, forgot-password placeholder OK, company/team selector optional.
- **T1.2 Role routing** — after login, internal → Dashboard; customer → Portal. Wrong role on a URL is denied, not “hidden button”.
- **T1.3 Customer password login** — Acme/Beta/Zenith accounts land on their quotes only.
- **T1.4 Magic-link issue** — on Approved→Sent (or explicit “Send to customer”), email a token link to the customer contact. Log the send on the quote and in Dashboard activity.
- **T1.5 Magic-link redeem** — open Screen 11 with no internal chrome. Expired/used token shows “request a new link”.
- **T1.6 Portal negotiation** — line comments, counter discount %, requested delivery date, Submit Request, Confirm Quotation.
- **T1.7 Portal side effects** — Submit Request sets `UNDER_NEGOTIATION` and emits `CustomerCountered` with the new discounts. Confirm emits `QuoteConfirmed` only if risk is still NONE given current lines; otherwise it must not confirm (P2 consumes the event and re-opens approval).
- **T1.8 Messages tab** — thread of customer comments + rep replies (can be quote-scoped). Enough to show “no email back and forth”.

P1 does **not** compute risk. P1 sends the new discount numbers. P2 decides if approval restarts.

### P2 tickets — Quote & Governance

- **T2.1 Product catalog list** — Screen 16. Counts, rows, click through.
- **T2.2 Product detail** — Screen 17. General info, subscription flag + cycle, variants + extra price, tier pricelist rules (USD only).
- **T2.3 Discount + chain setup** — Screen 18. Editable tier caps, category caps, three-row chain. Save is live for the next submit (not a restart).
- **T2.4 Quotations list** — Screen 3. Kanban from seed, table toggle, New Quotation.
- **T2.5 Quote builder** — Screen 4. Customer, pricelist, add/remove lines, qty, line discount, order discount, live Limit + Status, live margin.
- **T2.6 Risk engine** — pure function + the three fixtures: (a) Acme service +8pt → HIGH, (b) Nova all-in-cap → NONE, (c) three lines +2/+3/+2 → MEDIUM or HIGH via sumOver. Same function for live row status and for submit.
- **T2.7 Submit routing** — NONE skips humans; MEDIUM creates manager step; HIGH creates manager then finance. Rep never “requests approval” as a separate action.
- **T2.8 Approvals list** — Screen 5. Counts, filters, assigned-to, blended risk.
- **T2.9 Approval detail** — Screen 6. Why-flagged table, stepper, audit, Approve / Return / Reject with reason.
- **T2.10 Upsell panel** — ranked from pairings + promo + min margin. Add updates totals and risk immediately.
- **T2.11 Consume portal counters** — on `CustomerCountered`, recompute risk; if not NONE, set PENDING_APPROVAL at the required chain and notify P1 that Confirm is blocked.

### P3 tickets — Stock & Fulfillment

- **T3.1 Warehouse + stock tables** — Screen 7 top. On hand / reserved / available per warehouse × product.
- **T3.2 Socket feed** — subscribe Screen 7/8 (and quote line availability if shown) to `StockChanged`. Prove with a restock button or seed job that East Depot +8 laptops updates available without refresh.
- **T3.3 Reserve on confirm** — on `QuoteConfirmed`, reserve stockable qty (do not wait for ops to click Accept).
- **T3.4 Split planner** — suggested rows: warehouse, qty, shipments, cost. Acme 24 laptops → 18 Main + 6 East. Harbor 50 → three warehouses + backorder remainder.
- **T3.5 Fulfillment list** — orders awaiting fulfillment with status Split Pending / Backorder / Split Accepted.
- **T3.6 Fulfillment detail** — Screen 8. Accept Suggested Split, Manual Override (capped at available).
- **T3.7 Consolidate Remaining Backorder** — when socket shows newly available stock against a BACKORDER line, prompt appears; accepting re-runs planner on remaining qty.
- **T3.8 Delivery promise** — promised date on the order; if past and not fully fulfilled, emit a slippage signal for P4.

### P4 tickets — Cash & Health

- **T4.1 Split one-time vs recurring on confirm** — from the same order, build one-time invoice lines and subscription records separately.
- **T4.2 Subscriptions list** — Screen 9. Active / Paused / Cancelled counts and rows.
- **T4.3 Billing detail** — Screen 10. One-time block + recurring block + next bill dates. Modify qty (prorate). Cancel (credit note + kill future schedule).
- **T4.4 Invoices list** — Screen 12. Unpaid / Paid. Recurring vs one-time visible.
- **T4.5 Invoice detail** — Screen 13. Status stepper Order Confirmed → Shipped → Invoiced → Paid. Record Payment. Partial invoice stays aligned with what actually shipped (Harbor).
- **T4.6 PDF invoice** — real file, one-time or recurring, not mixed. Download from Screen 13.
- **T4.7 Deal Health** — Screen 14. Stalled (idle ≥ 7 days), discount anomaly (quote avg > that rep’s history + 10pt), delivery slippage. Nudge Rep / Escalate write audit and activity.
- **T4.8 Dashboard** — Screen 2. The three KPI cards + recent activity feed (including magic-link sent, stock updates, approvals).
- **T4.9 Reports** — Screen 15. Filters: period, team/rep, approval status, product. Export PDF and XLS/CSV. Quotes created, avg approval time, top upsold product.

---

## Phase 2 — join the tracks (all four)

This is where the mock’s arrows become real. Pair on these; do not “almost connect”.

- **T5.1 Happy auto-approve** — Q-1016: in-limit hardware only → submit → Approved → magic link → customer confirms → one warehouse fulfill → one-time invoice → pay → PDF. No manager involved.
- **T5.2 Hero HIGH path** — Q-1042 live: over-limit service, accept Care Plan upsell (totals/margin move), submit auto-routes HIGH, Shah approves, Iyer approves, magic link to Priya, she asks 15% on warranty, quote re-enters approval, after re-approve she confirms, 18+6 split, INV one-time + INV recurring, pay, PDF.
- **T5.3 Stock socket path** — Northwind backorder; ops restocks East Depot; Screen 7 ticks up live; Screen 8 shows Consolidate; accept; reserved/available move on the socket.
- **T5.4 Anomaly + stall** — Deal Health lists Zenith and Delta; Nudge and Escalate change the row and show on Dashboard activity.
- **T5.5 Permission pass** — rep cannot approve; customer URL has no internal nav; finance can record payment; magic-link user cannot open `/approvals`.

Done when the PDF’s 8-step test flow can be walked without a narrator saying “imagine this would happen”.

---

## Phase 3 — demo hardening

- **T6.1 Demo script** — one page, who logs in, which quote, what to click, expected numbers (12% OK, 18% OVER +8pt, split 18/6, INV-1042 $2730, INV-1043 $46).
- **T6.2 Reset seed** — one command/action that restores the seed so the next judge starts clean.
- **T6.3 Architecture one-pager** — modules + data objects + the state machine (no stack religion).
- **T6.4 NEXT.md** — multi-currency, real payment provider, multi-company. Not magic link, not PDF, not sockets — those already shipped.

---

## Cross-cutting “done” checks (every ticket)

- Matches the mock’s list/detail and labels where they exist.
- Uses the shared statuses/events from Phase 0.
- Visible result: a number, a status chip, an email, a PDF, or a socket update — not a console log.
- Seed rows exist so the screen is not empty on first run.

## Explicitly later

- Multi-currency / EUR pricelists as a live conversion
- Multi-company
- Real card network / payment provider (recording a payment in-app is enough)
- Multi-team company switcher beyond a display field
