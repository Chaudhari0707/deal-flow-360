import { and, asc, desc, eq, inArray, notInArray, sql } from "drizzle-orm";

import type { PurchaseRecommendations } from "@/features/quotes/_types/recommendations";
import { db } from "@/lib/db/connection";
import { customers, orders, products } from "@/lib/db/schema";
import { DomainError } from "@/server/errors";

export async function purchaseRecommendations(
  customerId: string,
  selectedProductIds: string[] = [],
): Promise<PurchaseRecommendations> {
  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.id, customerId));
  if (!customer) throw new DomainError("Customer not found", 404);
  const [lastOrder] = await db
    .select({ lines: orders.lines })
    .from(orders)
    .where(eq(orders.customerId, customerId))
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(1);
  if (lastOrder) {
    const ids = [...new Set(lastOrder.lines.map((line) => line.productId))].filter(
      (id) => !selectedProductIds.includes(id),
    );
    const available = ids.length
      ? await db
          .select({ id: products.id })
          .from(products)
          .where(and(eq(products.active, true), inArray(products.id, ids)))
          .orderBy(asc(products.id))
          .limit(5)
      : [];
    return { source: "last_purchase", productIds: available.map((product) => product.id) };
  }
  const bestSellers = await db.execute<{ id: string }>(sql`
    SELECT ${products.id} AS id
    FROM ${orders}
    CROSS JOIN LATERAL jsonb_array_elements(${orders.lines}) AS line
    INNER JOIN ${products} ON ${products.id} = line->>'productId'
    WHERE ${products.active} = true
      AND ${selectedProductIds.length ? notInArray(products.id, selectedProductIds) : sql`true`}
    GROUP BY ${products.id}
    ORDER BY SUM((line->>'quantity')::numeric) DESC, ${products.id} ASC
    LIMIT 5
  `);
  return { source: "best_sellers", productIds: bestSellers.map((product) => product.id) };
}
