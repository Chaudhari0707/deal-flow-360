import { asc, count, desc, eq, inArray } from "drizzle-orm";

import { stockDemand } from "@/features/inventory/stock";
import { db } from "@/lib/db/connection";
import { customers, orders, products } from "@/lib/db/schema/commerce";
import { reservations, stockMovements, stocks, warehouses } from "@/lib/db/schema/inventory";
import { DomainError } from "@/server/errors";

export async function inventorySnapshot(page = 0, pageSize = 100) {
  const [productRows, [total]] = await Promise.all([
    db
      .select({ id: products.id, name: products.name, variant: products.variant })
      .from(products)
      .where(eq(products.stockable, true))
      .orderBy(asc(products.name), asc(products.id))
      .limit(pageSize)
      .offset(page * pageSize),
    db.select({ count: count() }).from(products).where(eq(products.stockable, true)),
  ]);
  const productIds = productRows.map((product) => product.id);
  const [locations, balances] = await Promise.all([
    db.select().from(warehouses).orderBy(warehouses.name).limit(100),
    productIds.length
      ? db
          .select({
            id: stocks.id,
            warehouseId: stocks.warehouseId,
            productId: stocks.productId,
            onHand: stocks.onHand,
            reserved: stocks.reserved,
            version: stocks.version,
            name: products.name,
            variant: products.variant,
            warehouse: warehouses.name,
            replenishmentThreshold: warehouses.replenishmentThreshold,
          })
          .from(stocks)
          .innerJoin(products, eq(products.id, stocks.productId))
          .innerJoin(warehouses, eq(warehouses.id, stocks.warehouseId))
          .where(inArray(stocks.productId, productIds))
          .orderBy(stocks.productId, stocks.id)
      : Promise.resolve([]),
  ]);
  return {
    products: productRows,
    warehouses: locations,
    stocks: balances.map((s) => ({ ...s, available: s.onHand - s.reserved })),
    total: total?.count ?? 0,
  };
}

export async function fulfillmentList(page = 0, pageSize = 20) {
  const [items, [total]] = await Promise.all([
    db
      .select({
        id: orders.id,
        number: orders.number,
        customer: customers.name,
        fulfillmentStatus: orders.fulfillmentStatus,
        createdAt: orders.createdAt,
        promisedDate: orders.promisedDate,
      })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .orderBy(desc(orders.createdAt), asc(orders.id))
      .limit(pageSize)
      .offset(page * pageSize),
    db.select({ count: count() }).from(orders),
  ]);
  return { items, total: total?.count ?? 0 };
}

export async function fulfillmentDetail(id: string) {
  return db.transaction(
    async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, id));
      if (!order) throw new DomainError("Order not found", 404);
      const allocations = await tx
        .select({
          id: reservations.id,
          productId: reservations.productId,
          warehouseId: reservations.warehouseId,
          quantity: reservations.quantity,
          shipped: reservations.shipped,
          warehouse: warehouses.name,
          shippingWeight: warehouses.shippingWeight,
          product: products.name,
        })
        .from(reservations)
        .innerJoin(warehouses, eq(warehouses.id, reservations.warehouseId))
        .innerJoin(products, eq(products.id, reservations.productId))
        .where(eq(reservations.orderId, id))
        .orderBy(reservations.productId, reservations.warehouseId);
      const backorders = stockDemand(order.lines)
        .map((line) => ({
          ...line,
          quantity:
            line.quantity -
            allocations
              .filter((a) => a.productId === line.productId)
              .reduce((sum, a) => sum + a.quantity, 0),
          product: order.lines.find((l) => l.productId === line.productId)?.name ?? line.productId,
        }))
        .filter((line) => line.quantity > 0);
      const movements = await tx
        .select()
        .from(stockMovements)
        .where(eq(stockMovements.orderId, id))
        .orderBy(desc(stockMovements.createdAt))
        .limit(100);
      return {
        order,
        allocations,
        backorders,
        movements,
        shipmentCount: new Set(
          allocations.filter((a) => a.quantity > a.shipped).map((a) => a.warehouseId),
        ).size,
        shippingScore:
          [
            ...new Map(
              allocations
                .filter((a) => a.quantity > a.shipped)
                .map((a) => [a.warehouseId, a.shippingWeight]),
            ).values(),
          ].reduce((sum, weight) => sum + weight, 0) / 100,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
