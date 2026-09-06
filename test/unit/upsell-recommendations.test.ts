import { expect, test } from "bun:test";

import { defaultDiscounts } from "@/features/quotes/rules";
import { recommendUpsells } from "@/features/quotes/upsell-recommendations";
import type { Workspace } from "@/lib/domain/_types/workspace";

type Product = Workspace["products"][number];

function product(
  id: string,
  priceCents: number,
  pairedProductIds: string[] = [],
  overrides: Partial<Product> = {},
): Product {
  return {
    active: true,
    category: "Services",
    costCents: Math.floor(priceCents / 2),
    description: "",
    id,
    intervalMonths: 0,
    name: id,
    pairedProductIds,
    priceCents,
    promoted: false,
    promotionBps: 0,
    stockable: false,
    taxBps: 0,
    unit: "unit",
    variant: "Standard",
    ...overrides,
  };
}

const options = (products: Product[], selectedProductIds: string[]) => ({
  limits: defaultDiscounts,
  orderDiscountBps: 0,
  products,
  selectedProductIds,
  tier: "Bronze",
});

test("upsell recommendations rotate through selected products and retain only the five strongest slots", () => {
  const products = [
    product("source-a", 100, ["a-top", "a-next", "a-third"]),
    product("source-b", 100, ["b-top", "b-next"]),
    product("source-c", 100, ["c-top"]),
    product("a-top", 1_000),
    product("a-next", 300),
    product("a-third", 200),
    product("b-top", 900),
    product("b-next", 800),
    product("c-top", 700),
  ];

  expect(recommendUpsells(options(products, ["source-a", "source-b", "source-c"]))).toMatchObject([
    { product: { id: "a-top" } },
    { product: { id: "b-top" } },
    { product: { id: "c-top" } },
    { product: { id: "b-next" } },
    { product: { id: "a-next" } },
  ]);
});

test("upsell recommendations ignore already selected, inactive, and duplicate catalog pairings", () => {
  const products = [
    product("source-a", 100, ["shared", "inactive", "already-selected"]),
    product("source-b", 100, ["shared", "b-only"]),
    product("shared", 900),
    product("inactive", 800, [], { active: false }),
    product("already-selected", 700),
    product("b-only", 600),
  ];

  const recommendations = recommendUpsells(
    options(products, ["source-a", "source-b", "already-selected"]),
  );

  expect(recommendations.map((entry) => entry.product.id)).toEqual(["shared", "b-only"]);
  expect(recommendations).toHaveLength(2);
});
