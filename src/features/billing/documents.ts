import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts } from "pdf-lib";

import type { InvoiceDocument, ReportRow } from "@/features/billing/_types/documents";
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

export function reportPdf(rows: ReportRow[], filterDescription: string): Promise<Uint8Array> {
  return textPdf("DealFlow360 | Financial report", [
    filterDescription,
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
  const metadata = workbook.addWorksheet("Filters");
  metadata.addRow(["Filter", filterDescription]);
  metadata.addRow([
    "Credit convention",
    "Credit note totals are positive; subtract from billed amounts.",
  ]);
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
