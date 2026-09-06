# Quotation upsell recommendations

## Context

Customer purchase history and global best sellers can be useful reporting signals, but they are not
the catalog manager's intended relationship between products. A quotation needs recommendations that
come directly from the products the rep has already selected.

## Decision

Each `products.paired_product_ids` JSON array is a directional list of configured upsells. It holds
at most five IDs. The catalog API validates the list is unique, refers to existing products, and does
not contain the product being edited; PostgreSQL additionally enforces the five-item array limit.
The additive migration trims legacy arrays to their first five configured values before adding that
constraint.

The quotation editor reads the catalog already present in its workspace snapshot. It does not call a
customer-history recommendation endpoint. For every selected quotation product, it ranks that
product's active, unselected upsells by current estimated sale value, then margin, promotion
discount, and product ID. It takes one candidate from each selected source per pass, sorts that pass
by the same commercial priority, and stops after five unique products. This makes multiple selected
products share the recommendation rail while lower-value candidates lose the final slots.

Adding a recommendation sets the quote line's `upsell` flag. The quotation pricing service remains
authoritative: it retains that flag only when another selected product currently configures the
relationship.

## Alternatives

- Customer latest-purchase and best-seller suggestions were removed because they do not reflect the
  selected catalog item's configured upsell relationship.
- A normalized join table was not introduced: the existing product JSON relationship is already the
  selected storage model, and the requested maximum is small and directional.
- Selecting the five highest candidates globally was not chosen because it can starve one of several
  selected source products; pass-based allocation provides the requested division first.

## Consequences and verification

Inactive and already-selected products are excluded. A catalog product may retain an inactive
configured ID, but it will not be recommended until active again. The client derives estimates from
current tier pricing, promotion, and order discounts, so recommendations are not price snapshots.

The five-item API/database boundary and rollback behavior are covered by
[catalog upsell integration](../../test/integration/catalog-upsells.regression.test.ts). The allocator's
division, cap, deduplication, and inactive/selected exclusions are covered by
[unit tests](../../test/unit/upsell-recommendations.test.ts); the browser path is covered by
[the quotation recommendation spec](../../playwright/e2e/quote-recommendations.spec.ts).
