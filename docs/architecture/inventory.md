# Inventory and fulfillment

Implemented for DF-8: a local PostgreSQL ledger, an exact planner for three active warehouses, and
an authenticated Bun stock feed. Product IDs identify a specific SKU/variant. No Redis or separate
inventory database is required for the hackathon.

## What happens to a unit

```mermaid
sequenceDiagram
    accTitle: From confirmation to delivery
    accDescr: Confirmation reserves stock atomically. Operations accept the existing reservation, then ship it. Restock allows remaining backorders to be allocated.
    participant Customer
    participant API as Application API
    participant DB as PostgreSQL
    participant Ops as Operations
    participant Feed as Stock WebSocket
    Customer->>API: Confirm approved quote
    API->>DB: Lock quote, create order, lock stock in ID order
    API->>DB: Reserve available units and record backorder
    API->>DB: Commit order, reservations and billing together
    Feed->>DB: Read committed quantities
    Feed-->>Ops: Updated on hand, reserved, available, version
    Ops->>API: Accept suggested split
    API->>DB: Mark accepted without reserving again
    Ops->>API: Dispatch a reservation
    API->>DB: Reduce on hand and reserved together; record shipment
    Ops->>API: Receive stock, then consolidate backorder
    API->>DB: Allocate only demand that remains unreserved
```

- `available = onHand - reserved`; PostgreSQL enforces `onHand >= reserved >= 0`.
- `reservation.quantity` includes units already shipped. The unshipped amount is `quantity - shipped`.
- Remaining backorder is order demand minus the sum of reservation quantities, including shipped units.
- Every mutation locks the order first when applicable, then stock rows in stable ID order. Restock and
  shipment also serialize on a transaction-scoped operation-key lock before touching stock.
- Accept is a state change only. It cannot reserve a second time.
- Override replaces only this order's unshipped reservations. It may reuse those units, leaves another
  order's units protected, and records the reason and before/after allocation. Reducing allocations
  returns units to available stock and creates unreserved backorder.
- Consolidation reserves remaining backorder only. A retry against unchanged stock changes nothing.
- Shipment and restock operation keys must be unique. Identical retries return the prior movement;
  reusing a key for a different operation or payload returns a conflict.
- A failed write rolls back its reservations, balances, movements, and audit entry together.

## Planner

The planner maximizes fulfilled quantity, minimizes distinct dispatch warehouses across all products,
then minimizes the sum of warehouse shipping weights. Equal choices use stable warehouse IDs. Within
the chosen warehouses, greater available quantities are allocated first, then warehouse ID breaks ties.
Shipping weight is stored as an integer score multiplied by 100; it is not a currency charge.

The algorithm enumerates all warehouse subsets, which is exact and cheap at three warehouses. A
per-product greedy choice could unnecessarily create multiple dispatches. The canonical isolated
fixtures are Acme 24 laptops → Main 22 + East 2, and Harbor 50 → Main 22 + East 4 + West 4 + backorder 20.

Warehouse configuration allows up to 100 records and at most three active locations. Pause one before
activating another. Pausing excludes new planner allocations; existing reservations remain valid for
shipment. Receiving stock at a warehouse creates the balance if the product is new there, then
records the audited quantity change. Replenishment thresholds are alerts, not automatic purchasing.

## API contract

All routes are mounted under `/api/v1`. Better Auth sessions are checked server-side. Configuration
requires Admin; stock operations require Admin or Ops. Reads are limited to authorized internal roles.
Customer portal users cannot access warehouse quantities. JSON mutation bodies reject unknown fields.

| Method and path | Input | Result |
| --- | --- | --- |
| `GET /inventory` | `page` (0-based), `pageSize` (1–100) | Warehouses, paginated stock with available/version, total |
| `GET /fulfillment/orders` | Same pagination | Stable newest-first order summaries and total |
| `GET /fulfillment/:id` | Order ID | Order, allocations, backorders, last 100 movements, dispatch count/score |
| `POST /fulfillment/:id/accept` | None | Accepted order; repeated acceptance leaves stock unchanged |
| `POST /fulfillment/:id/override` | `allocations[{productId,warehouseId,quantity}]`, `reason` | Updated fulfillment status |
| `POST /fulfillment/:id/consolidate` | None | Added allocations, remaining backorders and status |
| `POST /fulfillment/:id/ship` | `reservationId`, `quantity`, `operationKey` | Movement ID, repeated flag and status on a new movement |
| `POST /inventory/restock` | `productId`, `warehouseId`, `quantity`, `reason`, `operationKey` | Movement ID and repeated flag |
| `POST /inventory/warehouses` | `name`, `active`, `shippingWeight`, `replenishmentThreshold` | New warehouse |
| `PATCH /inventory/warehouses/:id` | Same complete fields | Updated warehouse |
| `POST /inventory/stocks` | `productId`, `warehouseId` | Existing or newly configured zero balance |

Quantities are positive integers up to 1,000,000 at mutation boundaries; override omits zero rows.
Reasons have 3–500 characters. Conflicts return 409, unavailable resources 404, denied roles 403,
missing sessions 401, and malformed boundary input 400. Shipment requires prior split acceptance.
Fulfillment detail uses a repeatable-read transaction so its allocations and order state agree.

## Live stock and reconnect

Run `bun run realtime` alongside Next.js. The default WebSocket port is 3101, bound to
loopback; tests use 3102. The client derives its feed port as the current app port plus 101. The
`REALTIME_PORT` server setting must match this local convention.

`/stock` upgrades only for a permitted Origin and a valid internal Better Auth session. It shares
HTTP authentication's [loopback alias policy](../engineering/local-runtime.md#loopback-aliases-and-sign-in):
only the configured app origin and its same-scheme, same-port `localhost` / `127.0.0.1` alias are
accepted. Missing Origin remains forbidden. The CSP explicitly permits `ws://localhost` and
`ws://127.0.0.1` on the documented companion ports 3101 and 3102, without a wildcard. Cookies remain
HTTP-only and scoped to their hostname. The feed rechecks sessions and roles every 30 seconds. Each connection receives a full
`stock.snapshot` containing committed stock values and revisions. Once per second, a single bounded
poll reads up to 1,000 balances and broadcasts only when the snapshot changed. A reconnect receives
a new authoritative snapshot and revalidates affected SWR keys. It does not assume missed events
were delivered, and it cannot authorize a write. Client reconnect uses a capped exponential delay.

This intentionally trades a small polling cost and up to one second of display latency for simple,
recoverable local operation. Transactions and constraints, rather than the displayed count, decide
whether a write succeeds. A future larger deployment should measure this poll and then use committed
outbox events/PostgreSQL notifications, a shared fanout broker when multiple feed processes exist,
and an explicitly revised planner bound. No high-traffic capacity has been proven by these choices.

## Verification

`test/unit/inventory.test.ts` covers exact splits, global shipment minimization, input ordering,
empty stock and invalid quantities. `test/unit/inventory-override.regression.test.ts` covers reuse of
own reservations and protection of competing demand. `test/integration/inventory.regression.test.ts`
uses real PostgreSQL transactions and two independent connections to exercise concurrent reservation,
Accept/restock/consolidation/shipment retries, constraint rejection, and complete rollback.

`test/integration/inventory-socket.test.ts` exercises a real authenticated WebSocket, committed
restock publication, reconnect snapshots, forbidden origins, and logout. The browser scenario in
`playwright/e2e/inventory.spec.ts` exercises two Ops tabs, an observed stock frame and displayed
quantity change, restock, Northwind backorder consolidation, split acceptance, and one shipment.
A separate browser case proves a Rep cannot access mutation controls or bypass them through HTTP.
The browser suite needs the canonical demo seed; it intentionally consumes Northwind's backorder.
Integration fixtures clean up only their own generated IDs.
