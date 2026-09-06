import ExcelJS from "exceljs";

import type { ReportRow } from "@/features/billing/_types/documents";
import type { SalesReport } from "@/features/billing/_types/reports";

export { invoicePdf } from "@/features/billing/invoice-pdf";
export { reportPdf } from "@/features/billing/report-pdf";

export async function reportSpreadsheet(
  rows: ReportRow[],
  filterDescription: string,
  sales?: SalesReport,
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "DealFlow360";
  const sheet = workbook.addWorksheet("Financial report");
  sheet.columns = [
    { header: "Invoice", key: "number", width: 28 },
    { header: "Issue date (UTC)", key: "date", width: 15 },
    { header: "Customer", key: "customer", width: 30 },
    { header: "Category", key: "category", width: 18 },
    { header: "Kind", key: "kind", width: 15 },
    { header: "Status", key: "status", width: 15 },
    { header: "Total INR", key: "total", width: 18 },
    { header: "Paid INR", key: "paid", width: 18 },
    { header: "Outstanding INR", key: "outstanding", width: 18 },
  ];
  for (const row of rows)
    sheet.addRow({
      ...row,
      date: row.date.slice(0, 10),
      outstanding: row.outstandingCents / 100,
      paid: row.paidCents / 100,
      total: row.totalCents / 100,
    });
  sheet.getRow(1).font = { bold: true };
  for (const column of [7, 8, 9]) sheet.getColumn(column).numFmt = '"$"#,##0.00';
  sheet.autoFilter = "A1:I1";
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  if (sales) {
    const summary = workbook.addWorksheet("Sales metrics");
    summary.addRows([
      ["Metric", "Value"],
      ["Quotes created", sales.metrics.quotesCreated],
      ["Orders confirmed", sales.metrics.ordersConfirmed],
      ["Ordered INR", sales.metrics.orderedCents / 100],
      ["Average approval hours", sales.metrics.averageApprovalHours],
      ["Completed approval cycles", sales.metrics.completedApprovalCycles],
      ["Top upsold product", sales.metrics.topUpsoldProduct?.name ?? "None"],
      ["Top upsold units", sales.metrics.topUpsoldProduct?.quantity ?? 0],
    ]);
    for (const [name, records] of [
      ["Quotations", sales.quotes],
      ["Orders", sales.orders],
    ] as const) {
      const salesSheet = workbook.addWorksheet(name);
      salesSheet.columns = [
        { header: "Number", key: "number", width: 30 },
        { header: "Created (UTC)", key: "date", width: 18 },
        { header: "Customer", key: "customer", width: 25 },
        { header: "Representative", key: "representative", width: 25 },
        { header: "Team", key: "team", width: 20 },
        { header: "Status", key: "status", width: 22 },
        { header: "Amount INR", key: "amount", width: 18 },
      ];
      salesSheet.addRows(
        records.map((row) => ({
          ...row,
          date: row.date.slice(0, 10),
          amount: row.amountCents / 100,
        })),
      );
      salesSheet.getColumn(7).numFmt = '"$"#,##0.00';
      salesSheet.views = [{ state: "frozen", ySplit: 1 }];
      salesSheet.getRow(1).font = { bold: true };
    }
  }
  const metadata = workbook.addWorksheet("Filters");
  metadata.addRow(["Filter", filterDescription]);
  metadata.addRow([
    "Credit convention",
    "Credit note totals are positive; subtract from billed amounts.",
  ]);
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
