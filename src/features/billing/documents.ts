import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts } from "pdf-lib";

import type { InvoiceDocument, ReportRow } from "@/features/billing/_types/documents";
import type { SalesReport } from "@/features/billing/_types/reports";
import { invoiceOutstanding } from "@/features/billing/rules";

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { currency: "USD", style: "currency" }).format(cents / 100);
}

/** Standard PDF fonts cannot encode arbitrary Unicode; escape unsupported codepoints visibly. */
function printable(value: string): string {
  return value.replace(
    /[^\x20-\x7e\n]/gu,
    (character) => `[U+${character.codePointAt(0)?.toString(16).toUpperCase()}]`,
  );
}

async function textPdf(title: string, lines: string[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setCreator("DealFlow360");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const heading = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]);
  let y = 790;
  const addLine = (value: string, prominent = false) => {
    // Wrap by measured text width rather than truncating commercial facts.
    const characters = printable(value);
    let current = "";
    const draw = (text: string) => {
      if (y < 50) {
        page = pdf.addPage([595, 842]);
        y = 790;
      }
      page.drawText(text, {
        font: prominent ? heading : font,
        size: prominent ? 17 : 10,
        x: 40,
        y,
      });
      y -= prominent ? 29 : 17;
    };
    for (const character of characters) {
      const next = current + character;
      if (
        (prominent ? heading : font).widthOfTextAtSize(next, prominent ? 17 : 10) > 510 &&
        current
      ) {
        draw(current);
        current = character;
      } else current = next;
    }
    draw(current);
  };
  addLine(title, true);
  for (const line of lines) addLine(line);
  return pdf.save();
}

export function invoicePdf(invoice: InvoiceDocument): Promise<Uint8Array> {
  return textPdf(
    `DealFlow360 | ${invoice.kind === "credit" ? "Credit note" : "Invoice"} ${invoice.number}`,
    [
      `Customer: ${invoice.customer}`,
      `Issued: ${invoice.issuedAt.slice(0, 10)} | Due: ${invoice.dueAt.slice(0, 10)}`,
      `Billing stream: ${invoice.kind} | Status: ${invoice.status}`,
      ...(invoice.sourceNumber ? [`Source invoice: ${invoice.sourceNumber}`] : []),
      "",
      ...invoice.lines.map(
        (line) =>
          `${line.description} | Qty ${line.quantity} | Unit ${money(line.unitPriceCents)} | Line ${money(line.totalCents)}`,
      ),
      "",
      `Total: ${money(invoice.totalCents)}`,
      `Payments: ${money(invoice.paidCents)} | Credits applied: ${money(invoice.creditedCents)}`,
      `Outstanding: ${money(invoice.kind === "credit" ? 0 : invoiceOutstanding(invoice))}`,
      "Currency: USD. A credit note is not a cash refund. Fulfillment is tracked separately.",
    ],
  );
}

export function reportPdf(
  rows: ReportRow[],
  filterDescription: string,
  sales?: SalesReport,
): Promise<Uint8Array> {
  return textPdf("DealFlow360 | Sales and financial report", [
    filterDescription,
    ...(sales
      ? [
          `Quotes created: ${sales.metrics.quotesCreated} | Orders confirmed: ${sales.metrics.ordersConfirmed} | Ordered: ${money(sales.metrics.orderedCents)}`,
          `Average approval: ${sales.metrics.averageApprovalHours === null ? "No completed cycles" : `${sales.metrics.averageApprovalHours.toFixed(2)} hours`} | Completed cycles: ${sales.metrics.completedApprovalCycles}`,
          `Top upsold product: ${sales.metrics.topUpsoldProduct ? `${sales.metrics.topUpsoldProduct.name}, ${sales.metrics.topUpsoldProduct.quantity} units` : "No confirmed upsell units"}`,
          "Sales records (creation dates UTC):",
          ...[...sales.quotes, ...sales.orders].map(
            (row) =>
              `${row.kind} ${row.number} | ${row.date.slice(0, 10)} | ${row.customer} | ${row.representative} | ${row.team} | ${row.status} | ${money(row.amountCents)}`,
          ),
          "Financial records (issue dates UTC):",
        ]
      : []),
    `Rows: ${rows.length}. Dates use invoice issue date in UTC. Currency: USD.`,
    "",
    ...rows.flatMap((row) => [
      `${row.number} | ${row.date.slice(0, 10)} | ${row.customer} | ${row.category} | ${row.kind} | ${row.status}`,
      `Total ${money(row.totalCents)} | Paid ${money(row.paidCents)} | Outstanding ${money(row.outstandingCents)}`,
    ]),
    "",
    `Net billed: ${money(rows.reduce((sum, row) => sum + (row.kind === "credit" ? -row.totalCents : row.totalCents), 0))}`,
    `Paid: ${money(rows.reduce((sum, row) => sum + row.paidCents, 0))}`,
    `Outstanding: ${money(rows.reduce((sum, row) => sum + row.outstandingCents, 0))}`,
  ]);
}

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
    { header: "Total USD", key: "total", width: 18 },
    { header: "Paid USD", key: "paid", width: 18 },
    { header: "Outstanding USD", key: "outstanding", width: 18 },
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
      ["Ordered USD", sales.metrics.orderedCents / 100],
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
        { header: "Amount USD", key: "amount", width: 18 },
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
