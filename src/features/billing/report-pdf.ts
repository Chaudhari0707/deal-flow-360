import type { ReportRow } from "@/features/billing/_types/documents";
import type { PdfColumn, PdfDoc } from "@/features/billing/_types/pdf";
import type { SalesReport } from "@/features/billing/_types/reports";
import {
  A4_LANDSCAPE,
  dateOnly,
  drawBrandBar,
  drawTableHeader,
  drawTableRow,
  ensureSpace,
  GRAY_400,
  GRAY_600,
  MARGIN,
  measureTableRow,
  money,
  NAVY,
  openPdf,
  stampFooters,
  wrapText,
} from "@/features/billing/pdf-layout";

const FINANCIAL_COLUMNS: PdfColumn[] = [
  { header: "Invoice", width: 88 },
  { header: "Issue date", width: 68 },
  { header: "Customer", width: 150 },
  { header: "Category", width: 86 },
  { header: "Kind", width: 72 },
  { header: "Status", width: 68 },
  { align: "right", header: "Total", width: 76 },
  { align: "right", header: "Paid", width: 72 },
  { align: "right", header: "Outstanding", width: 82 },
];

const SALES_COLUMNS: PdfColumn[] = [
  { header: "Kind", width: 64 },
  { header: "Number", width: 96 },
  { header: "Created", width: 68 },
  { header: "Customer", width: 140 },
  { header: "Representative", width: 120 },
  { header: "Team", width: 80 },
  { header: "Status", width: 90 },
  { align: "right", header: "Amount", width: 80 },
];

export async function reportPdf(
  rows: ReportRow[],
  filterDescription: string,
  sales?: SalesReport,
): Promise<Uint8Array> {
  const doc = await openPdf("DealFlow360 | Sales and financial report", A4_LANDSCAPE);
  const intro = () => {
    drawBrandBar(doc, "Report");
    doc.page.drawText("Sales and financial report", {
      color: NAVY,
      font: doc.bold,
      size: 14,
      x: MARGIN,
      y: doc.y,
    });
    doc.y -= 16;
  };
  intro();
  drawWrapped(doc, filterDescription, 8, GRAY_600);
  drawWrapped(
    doc,
    `Rows: ${rows.length}. Dates use invoice issue date in UTC. Currency: USD.`,
    8,
    GRAY_400,
  );
  if (sales) drawMetrics(doc, sales, intro);
  drawSection(doc, "Financial records", FINANCIAL_COLUMNS, financialValues, rows, intro);
  drawSummary(doc, rows, intro);
  if (sales) {
    drawSection(doc, "Quotations", SALES_COLUMNS, salesValues, sales.quotes, intro);
    drawSection(doc, "Orders", SALES_COLUMNS, salesValues, sales.orders, intro);
  }
  stampFooters(
    doc,
    "Credit note totals are positive; subtract from billed amounts. Currency: USD.",
  );
  return doc.pdf.save();
}

function financialValues(row: ReportRow): string[] {
  return [
    row.number,
    dateOnly(row.date),
    row.customer,
    row.category,
    row.kind,
    row.status,
    money(row.totalCents),
    money(row.paidCents),
    money(row.outstandingCents),
  ];
}

function salesValues(row: SalesReport["quotes"][number]): string[] {
  return [
    row.kind,
    row.number,
    dateOnly(row.date),
    row.customer,
    row.representative,
    row.team,
    row.status,
    money(row.amountCents),
  ];
}

function drawWrapped(doc: PdfDoc, value: string, size: number, color: typeof GRAY_600) {
  const width = doc.width - MARGIN * 2;
  for (const line of wrapText(doc.regular, value, size, width)) {
    ensureSpace(doc, size + 6, () => drawBrandBar(doc, "Report"));
    if (line) {
      doc.page.drawText(line, { color, font: doc.regular, size, x: MARGIN, y: doc.y });
    }
    doc.y -= size + 5;
  }
}

function drawMetrics(doc: PdfDoc, sales: SalesReport, intro: () => void) {
  ensureSpace(doc, 56, intro);
  doc.y -= 4;
  doc.page.drawText("Sales metrics", {
    color: NAVY,
    font: doc.bold,
    size: 10,
    x: MARGIN,
    y: doc.y,
  });
  doc.y -= 14;
  const top = sales.metrics.topUpsoldProduct;
  const metrics = [
    `Quotes created: ${sales.metrics.quotesCreated}`,
    `Orders confirmed: ${sales.metrics.ordersConfirmed}`,
    `Ordered: ${money(sales.metrics.orderedCents)}`,
    `Average approval: ${sales.metrics.averageApprovalHours === null ? "No completed cycles" : `${sales.metrics.averageApprovalHours.toFixed(2)} hours`}`,
    `Completed cycles: ${sales.metrics.completedApprovalCycles}`,
    `Top upsold product: ${top ? `${top.name}, ${top.quantity} units` : "No confirmed upsell units"}`,
  ];
  drawWrapped(doc, metrics.join("   ·   "), 8, GRAY_600);
}

function drawSection<T>(
  doc: PdfDoc,
  title: string,
  columns: PdfColumn[],
  values: (row: T) => string[],
  rows: T[],
  intro: () => void,
) {
  const header = () => {
    intro();
    doc.page.drawText(`${title} (continued)`, {
      color: GRAY_400,
      font: doc.regular,
      size: 9,
      x: MARGIN,
      y: doc.y,
    });
    doc.y -= 14;
    drawTableHeader(doc, columns, MARGIN);
  };
  ensureSpace(doc, 36, intro);
  doc.y -= 6;
  doc.page.drawText(title, { color: NAVY, font: doc.bold, size: 10, x: MARGIN, y: doc.y });
  doc.y -= 14;
  drawTableHeader(doc, columns, MARGIN);
  if (!rows.length) {
    ensureSpace(doc, 16, header);
    doc.page.drawText("No rows in this section.", {
      color: GRAY_400,
      font: doc.regular,
      size: 8,
      x: MARGIN + 4,
      y: doc.y - 10,
    });
    doc.y -= 18;
    return;
  }
  rows.forEach((row, index) => {
    const cells = values(row);
    const height = measureTableRow(doc.regular, columns, cells);
    ensureSpace(doc, height, header);
    drawTableRow(doc, columns, cells, MARGIN, { zebra: index % 2 === 1 });
  });
}

function drawSummary(doc: PdfDoc, rows: ReportRow[], intro: () => void) {
  const billed = rows.reduce(
    (sum, row) => sum + (row.kind === "credit" ? -row.totalCents : row.totalCents),
    0,
  );
  const paid = rows.reduce((sum, row) => sum + row.paidCents, 0);
  const outstanding = rows.reduce((sum, row) => sum + row.outstandingCents, 0);
  ensureSpace(doc, 58, intro);
  doc.y -= 10;
  const items = [
    ["Net billed", money(billed)],
    ["Paid", money(paid)],
    ["Outstanding", money(outstanding)],
  ] as const;
  const labelX = doc.width - MARGIN - 220;
  for (const [label, value] of items) {
    doc.page.drawText(label, { color: GRAY_600, font: doc.regular, size: 9, x: labelX, y: doc.y });
    const font = label === "Outstanding" ? doc.bold : doc.regular;
    doc.page.drawText(value, {
      color: NAVY,
      font,
      size: label === "Outstanding" ? 11 : 9,
      x: doc.width - MARGIN - font.widthOfTextAtSize(value, label === "Outstanding" ? 11 : 9),
      y: doc.y,
    });
    doc.y -= 15;
  }
}
