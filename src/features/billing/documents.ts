import ExcelJS from "exceljs";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

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

const NAVY = rgb(0.07, 0.14, 0.24);
const SKY = rgb(0.01, 0.52, 0.78);
const GRAY_600 = rgb(0.28, 0.33, 0.41);
const GRAY_400 = rgb(0.58, 0.64, 0.72);
const BORDER = rgb(0.89, 0.91, 0.94);
const BG_LIGHT = rgb(0.97, 0.98, 0.99);
const WHITE = rgb(1, 1, 1);

async function embedLogo(pdf: Awaited<ReturnType<typeof PDFDocument.create>>) {
  try {
    const root = import.meta.dir.replace(/[\\/]src[\\/]features[\\/]billing$/, "");
    const logoFile = Bun.file(`${root}/public/logo.png`);
    if (await logoFile.exists()) {
      return await pdf.embedPng(await logoFile.arrayBuffer());
    }
  } catch {
    /* Continue without logo */
  }
  return null;
}

function drawHorizontalLine(
  page: ReturnType<Awaited<ReturnType<typeof PDFDocument.create>>["addPage"]>,
  y: number,
  x1: number,
  x2: number,
) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.5, color: BORDER });
}

async function textPdf(title: string, lines: string[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setCreator("DealFlow360");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const heading = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]);
  let y = 790;

  const logo = await embedLogo(pdf);
  if (logo) {
    const logoWidth = 160;
    const logoHeight = 53;
    page.drawImage(logo, { height: logoHeight, width: logoWidth, x: 40, y: y - logoHeight + 8 });
    y -= logoHeight + 20;
  }

  const addLine = (value: string, prominent = false) => {
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
        color: prominent ? NAVY : GRAY_600,
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

export async function invoicePdf(invoice: InvoiceDocument): Promise<Uint8Array> {
  const isCredit = invoice.kind === "credit";
  const docLabel = isCredit ? "Credit Note" : "Invoice";
  const pdf = await PDFDocument.create();
  pdf.setTitle(`DealFlow360 | ${docLabel} ${invoice.number}`);
  pdf.setCreator("DealFlow360");

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595, 842]);
  const W = 595;
  const ML = 40;
  const MR = 40;
  const CW = W - ML - MR;
  let y = 800;

  // ── Header band ──
  page.drawRectangle({ x: 0, y: 790, width: W, height: 52, color: NAVY });

  const logo = await embedLogo(pdf);
  if (logo) {
    page.drawImage(logo, { x: ML, y: 798, width: 130, height: 36 });
  } else {
    page.drawText("DealFlow360", { x: ML, y: 808, font: bold, size: 18, color: WHITE });
  }

  page.drawText(docLabel.toUpperCase(), {
    x: W - MR - bold.widthOfTextAtSize(docLabel.toUpperCase(), 16),
    y: 808,
    font: bold,
    size: 16,
    color: WHITE,
  });
  y = 770;

  // ── Invoice number + dates row ──
  page.drawText(invoice.number, { x: ML, y, font: bold, size: 14, color: NAVY });
  const dateText = `Issued: ${printable(invoice.issuedAt.slice(0, 10))}  |  Due: ${printable(invoice.dueAt.slice(0, 10))}`;
  page.drawText(dateText, {
    x: W - MR - regular.widthOfTextAtSize(dateText, 9),
    y: y + 2,
    font: regular,
    size: 9,
    color: GRAY_400,
  });
  y -= 24;

  // ── Customer + status ──
  page.drawText(`Customer: ${printable(invoice.customer)}`, {
    x: ML,
    y,
    font: regular,
    size: 10,
    color: GRAY_600,
  });
  const statusLabel = printable(invoice.status);
  const statusWidth = bold.widthOfTextAtSize(statusLabel, 9);
  const statusColor = invoice.status === "PAID" ? rgb(0.05, 0.6, 0.35) : SKY;
  page.drawRectangle({
    x: W - MR - statusWidth - 12,
    y: y - 3,
    width: statusWidth + 12,
    height: 16,
    color: statusColor,
    borderWidth: 0,
  });
  page.drawText(statusLabel, {
    x: W - MR - statusWidth - 6,
    y: y + 1,
    font: bold,
    size: 9,
    color: WHITE,
  });
  y -= 16;
  page.drawText(`Stream: ${printable(invoice.kind)}`, {
    x: ML,
    y,
    font: regular,
    size: 9,
    color: GRAY_400,
  });
  if (invoice.sourceNumber) {
    page.drawText(`Source: ${printable(invoice.sourceNumber)}`, {
      x: ML + 160,
      y,
      font: regular,
      size: 9,
      color: GRAY_400,
    });
  }
  y -= 24;

  // ── Line items table ──
  drawHorizontalLine(page, y, ML, W - MR);
  y -= 4;
  page.drawRectangle({ x: ML, y: y - 12, width: CW, height: 16, color: BG_LIGHT });
  const colX = { desc: ML + 4, qty: ML + 280, unit: ML + 340, total: ML + 430 };
  const headerY = y - 9;
  page.drawText("Description", { x: colX.desc, y: headerY, font: bold, size: 8, color: GRAY_400 });
  page.drawText("Qty", { x: colX.qty, y: headerY, font: bold, size: 8, color: GRAY_400 });
  page.drawText("Unit Price", { x: colX.unit, y: headerY, font: bold, size: 8, color: GRAY_400 });
  page.drawText("Total", { x: colX.total, y: headerY, font: bold, size: 8, color: GRAY_400 });
  y -= 16;
  drawHorizontalLine(page, y, ML, W - MR);
  y -= 6;

  for (const line of invoice.lines) {
    y -= 14;
    page.drawText(printable(line.description), {
      x: colX.desc,
      y,
      font: regular,
      size: 9,
      color: NAVY,
    });
    page.drawText(String(line.quantity), {
      x: colX.qty,
      y,
      font: regular,
      size: 9,
      color: GRAY_600,
    });
    page.drawText(money(line.unitPriceCents), {
      x: colX.unit,
      y,
      font: regular,
      size: 9,
      color: GRAY_600,
    });
    const lineTotal = money(line.totalCents);
    page.drawText(lineTotal, {
      x: colX.total + 50 - regular.widthOfTextAtSize(lineTotal, 9),
      y,
      font: regular,
      size: 9,
      color: NAVY,
    });
    y -= 4;
    drawHorizontalLine(page, y, ML, W - MR);
  }
  y -= 12;

  // ── Totals section (right-aligned) ──
  const totalsX = ML + 300;
  const totalsValX = ML + 430;

  const drawTotalRow = (label: string, value: string, isBold = false) => {
    page.drawText(label, {
      x: totalsX,
      y,
      font: isBold ? bold : regular,
      size: isBold ? 11 : 9,
      color: isBold ? NAVY : GRAY_600,
    });
    const f = isBold ? bold : regular;
    const s = isBold ? 11 : 9;
    page.drawText(value, {
      x: totalsValX + 50 - f.widthOfTextAtSize(value, s),
      y,
      font: f,
      size: s,
      color: isBold ? NAVY : GRAY_600,
    });
    y -= isBold ? 22 : 16;
  };

  drawTotalRow("Subtotal", money(invoice.totalCents));
  if (invoice.paidCents > 0) drawTotalRow("Payments", `- ${money(invoice.paidCents)}`);
  if (invoice.creditedCents > 0)
    drawTotalRow("Credits applied", `- ${money(invoice.creditedCents)}`);
  drawHorizontalLine(page, y + 6, totalsX, W - MR);
  y -= 4;
  drawTotalRow("Outstanding", money(isCredit ? 0 : invoiceOutstanding(invoice)), true);

  // ── Footer ──
  y = 40;
  drawHorizontalLine(page, y + 16, ML, W - MR);
  page.drawText(
    "Currency: USD. A credit note is not a cash refund. Fulfillment is tracked separately.",
    {
      x: ML,
      y,
      font: regular,
      size: 7,
      color: GRAY_400,
    },
  );
  page.drawText("DealFlow360 - Sales Flow. Smarter.", {
    x: W - MR - regular.widthOfTextAtSize("DealFlow360 - Sales Flow. Smarter.", 7),
    y,
    font: regular,
    size: 7,
    color: GRAY_400,
  });

  return pdf.save();
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
