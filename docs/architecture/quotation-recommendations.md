# Quotation recommendations

DF-15 adds a Recommended products panel when creating or editing a quotation.
The selected customer's most recent confirmed order supplies up to five active products.
Orders are sorted by creation time, then descending ID to resolve ties. Products are
sorted by ID. Draft, sent and approved quotations alone do not count as purchases.
Payment and shipment do not need to be complete.

If the customer has never ordered, suggestions use all-time best sellers across
confirmed orders, ranked by total units ordered, then ascending product ID for ties.
Only active products qualify. No sales means an empty panel; a previous purchase
containing only inactive products also yields an empty panel, without falling back.

`GET /api/v1/quotes/recommendations?customerId=...` requires a rep
session, matching quotation creation. Customers are shared records in this
single-organization application. The response contains only `source`
(`last_purchase` or `best_sellers`) and `productIds`, with no other customer or
order details. Missing customers return 404. Responses are private and not cached
by HTTP caches.

The optional `selectedProductIds` query array uses repeated query parameters
(`selectedProductIds=a&selectedProductIds=b`) and accepts at most 100 nonempty product IDs
(each at most 100 characters). Selected products are excluded before the five-product
limit is applied, so adding products refills suggestions from the same ranked source.
Removing products makes them eligible again. The SWR key includes customer and sorted,
deduplicated selected IDs. Fewer than five eligible products yields a shorter list;
the system never invents products to fill the panel.

Already-added products are hidden. Changing customers loads a separate result
without displaying the prior customer's suggestions. Adding uses the current catalog, promotion and customer-tier pricing
through the existing quotation pricing flow, not historical prices. These ordinary
product additions do not count as paired-product upsells. The existing paired-product
panel remains available. The editor's loaded catalog determines which returned IDs
can be added; catalog pagination is unchanged.

Each recommendation shows one pricing detail: products with an active nonzero promotion
show the promotion discount; other products show estimated one-unit margin using the
selected customer tier and current order discount. For example, a promoted care plan
shows “Promotion discount 5.00%”, while a regular service shows its estimated INR margin.
Promotion percentages are actual configured discounts, not maximum policy allowances;
normal approval checks still apply. The server remains authoritative when saved.
