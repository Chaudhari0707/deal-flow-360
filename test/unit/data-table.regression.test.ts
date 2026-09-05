import { expect, test } from "bun:test";

import { createElement } from "react";
import { useTable } from "@tanstack/react-table";
import { renderToStaticMarkup } from "react-dom/server";

import { dataTableFeatures } from "@/components/ui/data-table/features";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

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

test("shared table preserves the CRAzy Collection pinned-column and row-hover chrome", () => {
  const markup = renderToStaticMarkup(
    createElement(
      Table,
      { containerClassName: "overflow-visible" },
      createElement(
        TableBody,
        null,
        createElement(TableRow, null, createElement(TableCell, null, "Pinned value")),
      ),
    ),
  );
  expect(markup).toContain("overflow-visible");
  expect(markup).toContain("border-separate");
  expect(markup).toContain("group/table-row");
});
