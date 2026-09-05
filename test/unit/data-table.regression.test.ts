import { expect, test } from "bun:test";

import { createElement } from "react";
import { useTable } from "@tanstack/react-table";
import { renderToStaticMarkup } from "react-dom/server";

import { dataTableFeatures } from "@/components/ui/data-table/features";

function TableFixture() {
  const table = useTable({
    features: dataTableFeatures,
    columns: [{ accessorKey: "name" }, { accessorKey: "price" }],
    data: [
      { name: "Laptop", price: 300 },
      { name: "Mouse", price: 20 },
      { name: "Laptop case", price: 40 },
    ],
    initialState: {
      columnFilters: [{ id: "name", value: "laptop" }],
      sorting: [{ id: "price", desc: false }],
    },
  });
  return createElement(
    "div",
    null,
    table
      .getRowModel()
      .rows.map((row) => row.original.name)
      .join(","),
  );
}

test("shared table filters text and sorts numbers with registered built-in functions", () => {
  expect(renderToStaticMarkup(createElement(TableFixture))).toBe("<div>Laptop case,Laptop</div>");
});
