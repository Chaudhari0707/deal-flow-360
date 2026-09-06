import type { ReportRow } from "@/features/billing/_types/documents";
import type { PdfColumn, PdfDoc } from "@/features/billing/_types/pdf";
import type { SalesRecord, SalesReport } from "@/features/billing/_types/reports";
import {
  A4_LANDSCAPE,
  BG_LIGHT,
  BORDER,
  drawBrandBar,
  drawRight,
  GRAY_600,
  GREEN,
  MARGIN,
  NAVY,
  newPage,
  openPdf,
  printable,
  SKY,
  stampFooters,
  WHITE,
  wrapText,
} from "@/features/billing/pdf-layout";
import { documentMoney as money } from "@/lib/money";

type Totals = ReturnType<typeof summarise>;
type ChartEntry = [string, number];

const CONTENT_WIDTH = A4_LANDSCAPE.width - MARGIN * 2;
const CHART_WIDTH = 366;
const CHART_RIGHT_X = 436;
const FIGURE_TOP = 478;
const FIGURE_HEIGHT = 76;
const CHART_TITLE_Y = 372;
const BAR_TOP = 344;
const BAR_STEP = 34;
const AXIS_TOP = 356;
const AXIS_BOTTOM = 192;
const BODY_BOTTOM = 66;
const ROW_LINE = 11;
const ROW_SIZE = 8;
const PLOTTED_STATUSES = 4;

const FINANCIAL_COLUMNS: PdfColumn[] = [
  { header: "Number / issue date", width: 142 },
  { header: "Customer / category", width: 178 },
  { header: "Kind / status", width: 120 },
  { align: "right", header: "Total (INR)", width: 108 },
  { align: "right", header: "Paid (INR)", width: 108 },
  { align: "right", header: "Outstanding (INR)", width: 106 },
];

const SALES_COLUMNS: PdfColumn[] = [
  { header: "Number / date", width: 150 },
  { header: "Customer", width: 180 },
  { header: "Representative / team", width: 190 },
  { header: "Status", width: 110 },
  { align: "right", header: "Amount (INR)", width: 132 },
];

/** Vector charts and paginated registers use exactly the filtered export records. */
export async function reportPdf(
  rows: ReportRow[],
  filterDescription: string,
  sales?: SalesReport,
): Promise<Uint8Array> {
  const doc = await openPdf("DealFlow360 | Sales and financial report", A4_LANDSCAPE);
  doc.pdf.setSubject(
    "Executive summary, financial comparison, quotation status and detailed records (INR)",
  );
  const generated = `${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC`;
  const totals = summarise(rows);
  openSection(
    doc,
    "Sales & financial report",
    "Selected records only. Financial and sales cohorts use their own dates.",
    false,
  );
  drawFigures(doc, totals);
  drawBars(doc, "Financial comparison (INR)", financialEntries(totals), MARGIN, true);
  drawBars(doc, "Quotation status (count)", quotationEntries(sales), CHART_RIGHT_X, false);
  drawSummaryNotes(doc, rows.length, sales);
  drawScope(doc, filterDescription, generated, sales);
  if (sales) {
    drawRegister(doc, "Quotation register", SALES_COLUMNS, sales.quotes.map(salesCells));
    drawRegister(doc, "Confirmed order register", SALES_COLUMNS, sales.orders.map(salesCells));
  }
  drawRegister(doc, "Financial register", FINANCIAL_COLUMNS, rows.map(financialCells));
  stampFooters(
    doc,
    "Credit note totals are positive; subtract from billed amounts. Currency: INR.",
  );
  return doc.pdf.save();
}

function summarise(rows: ReportRow[]) {
  const credits = rows
    .filter((row) => row.kind === "credit")
    .reduce((sum, row) => sum + row.totalCents, 0);
  const invoiced = rows
    .filter((row) => row.kind !== "credit")
    .reduce((sum, row) => sum + row.totalCents, 0);
  return {
    collected: rows.reduce((sum, row) => sum + row.paidCents, 0),
    credits,
    invoiced,
    net: invoiced - credits,
    outstanding: rows.reduce((sum, row) => sum + row.outstandingCents, 0),
  };
}

function financialEntries(totals: Totals): ChartEntry[] {
  return [
    ["Invoiced", totals.invoiced],
    ["Credit notes", totals.credits],
    ["Net billed", totals.net],
    ["Collected", totals.collected],
    ["Outstanding", totals.outstanding],
  ];
}

function quotationEntries(sales?: SalesReport): ChartEntry[] {
  const counts = new Map<string, number>();
  for (const quote of sales?.quotes ?? [])
    counts.set(quote.status, (counts.get(quote.status) ?? 0) + 1);
  const ranked = [...counts].sort((left, right) => right[1] - left[1]);
  const plotted: ChartEntry[] = ranked
    .slice(0, PLOTTED_STATUSES)
    .map(([status, count]) => [status.replaceAll("_", " "), count]);
  if (ranked.length > PLOTTED_STATUSES)
    plotted.push([
      "OTHER STATUSES",
      ranked.slice(PLOTTED_STATUSES).reduce((sum, entry) => sum + entry[1], 0),
    ]);
  return plotted;
}

function openSection(doc: PdfDoc, title: string, note: string, fresh: boolean) {
  if (fresh) newPage(doc);
  drawBrandBar(doc, "Report");
  doc.page.drawText(printable(title), {
    color: NAVY,
    font: doc.bold,
    size: 16,
    x: MARGIN,
    y: doc.y - 6,
  });
  doc.page.drawText(printable(note), {
    color: GRAY_600,
    font: doc.regular,
    size: 9,
    x: MARGIN,
    y: doc.y - 26,
  });
  doc.y -= 46;
}

function drawFigures(doc: PdfDoc, totals: Totals) {
  const width = (CONTENT_WIDTH - 30) / 3;
  const figures: ChartEntry[] = [
    ["NET BILLED", totals.net],
    ["PAYMENTS COLLECTED", totals.collected],
    ["OUTSTANDING", totals.outstanding],
  ];
  figures.forEach(([label, value], index) => {
    const x = MARGIN + index * (width + 15);
    doc.page.drawRectangle({
      color: BG_LIGHT,
      height: FIGURE_HEIGHT,
      width,
      x,
      y: FIGURE_TOP - FIGURE_HEIGHT,
    });
    doc.page.drawText(label, {
      color: GRAY_600,
      font: doc.bold,
      size: 9,
      x: x + 14,
      y: FIGURE_TOP - 22,
    });
    const amount = money(value);
    const size = Math.min(22, (width - 28) / doc.bold.widthOfTextAtSize(amount, 1));
    doc.page.drawText(amount, { color: NAVY, font: doc.bold, size, x: x + 14, y: FIGURE_TOP - 60 });
  });
}

function drawBars(doc: PdfDoc, title: string, entries: ChartEntry[], x: number, monetary: boolean) {
  doc.page.drawText(title, { color: NAVY, font: doc.bold, size: 13, x, y: CHART_TITLE_Y });
  if (entries.every(([, value]) => value === 0)) {
    doc.page.drawText("No matching activity to chart.", {
      color: GRAY_600,
      font: doc.regular,
      size: 10,
      x,
      y: 320,
    });
    return;
  }
  const max = Math.max(1, ...entries.map(([, value]) => Math.abs(value)));
  const plotWidth = CHART_WIDTH - 130;
  const signed = entries.some(([, value]) => value < 0);
  const origin = x + 120 + (signed ? plotWidth / 2 : 0);
  const scale = (signed ? plotWidth / 2 : plotWidth) / max;
  doc.page.drawLine({
    color: BORDER,
    end: { x: origin, y: AXIS_TOP },
    start: { x: origin, y: AXIS_BOTTOM },
    thickness: 1,
  });
  entries.forEach(([label, value], index) => {
    const top = BAR_TOP - index * BAR_STEP;
    doc.page.drawText(printable(label), {
      color: GRAY_600,
      font: doc.regular,
      size: 9,
      x,
      y: top,
    });
    const length = Math.abs(value) * scale;
    if (length > 0)
      doc.page.drawRectangle({
        color: value < 0 ? GRAY_600 : monetary ? GREEN : SKY,
        height: 7,
        width: length,
        x: value < 0 ? origin - length : origin,
        y: top - 13,
      });
    drawRight(
      doc.page,
      monetary ? money(value) : String(value),
      x + CHART_WIDTH,
      top,
      doc.bold,
      8,
      NAVY,
    );
  });
}

function drawSummaryNotes(doc: PdfDoc, rowCount: number, sales?: SalesReport) {
  const caption = (value: string, x: number) =>
    doc.page.drawText(value, { color: GRAY_600, font: doc.regular, size: 8, x, y: 168 });
  caption("Credits reduce net billed; these amounts are not additive.", MARGIN);
  caption("Status counts are not a conversion funnel.", CHART_RIGHT_X);
  doc.page.drawRectangle({ color: BG_LIGHT, height: 52, width: CONTENT_WIDTH, x: MARGIN, y: 84 });
  const lead = (value: string, x: number) =>
    doc.page.drawText(printable(value), { color: NAVY, font: doc.bold, size: 10, x, y: 116 });
  const detail = (value: string, x: number) =>
    doc.page.drawText(printable(value), { color: GRAY_600, font: doc.regular, size: 9, x, y: 98 });
  lead(
    sales
      ? `${sales.metrics.quotesCreated} QUOTES  /  ${sales.metrics.ordersConfirmed} CONFIRMED ORDERS`
      : "No sales dataset supplied",
    MARGIN + 14,
  );
  detail(
    sales
      ? `Ordered value: ${money(sales.metrics.orderedCents)}`
      : `${rowCount} financial records in the selection`,
    MARGIN + 14,
  );
  lead(
    sales?.metrics.averageApprovalHours == null
      ? "Approval time: no completed cycles"
      : `Average approval: ${sales.metrics.averageApprovalHours.toFixed(2)} hours`,
    CHART_RIGHT_X,
  );
  detail(`${sales?.metrics.completedApprovalCycles ?? 0} completed approval cycles`, CHART_RIGHT_X);
}

function drawScope(doc: PdfDoc, filterDescription: string, generated: string, sales?: SalesReport) {
  openSection(
    doc,
    "Report scope & interpretation",
    "Read alongside the charts and detail tables.",
    true,
  );
  const upsold = sales?.metrics.topUpsoldProduct;
  const paragraphs = [
    `Generated: ${generated}`,
    `Active filters: ${filterDescription}`,
    "All amounts are INR. Dates are UTC. Quote and order charts use creation dates; financial records use invoice or credit issue dates. Payment status filters financial records only. Product and category filters select whole records with a matching line.",
    "Credit totals are positive in the register and subtracted from invoiced amounts for net billed. A credit is not a cash refund. Collected payments and outstanding balances describe the selected issued documents, not cash movements during the date range.",
    ...(sales
      ? [
          upsold
            ? `Top upsold product: ${upsold.name} / ${upsold.quantity} confirmed units.`
            : "Top upsold product: no confirmed upsells in this selection.",
        ]
      : []),
    "Charts display exact values next to each bar. Negative net billing extends left of zero. Where more than four quotation statuses exist, the remaining counts are grouped as Other statuses. Full records follow, with repeated column headings and page numbers.",
  ];
  for (const paragraph of paragraphs) {
    for (const line of wrapText(doc.regular, paragraph, 10, CONTENT_WIDTH)) {
      if (doc.y < BODY_BOTTOM)
        openSection(doc, "Report scope (continued)", "Selection and reporting conventions", true);
      if (line)
        doc.page.drawText(line, { color: NAVY, font: doc.regular, size: 10, x: MARGIN, y: doc.y });
      doc.y -= 15;
    }
    doc.y -= 14;
  }
}

function financialCells(row: ReportRow): string[] {
  return [
    `${row.number}\n${row.date.slice(0, 10)}`,
    `${row.customer}\n${row.category}`,
    `${row.kind}\n${row.status}`,
    money(row.totalCents),
    money(row.paidCents),
    money(row.outstandingCents),
  ];
}

function salesCells(row: SalesRecord): string[] {
  return [
    `${row.number}\n${row.date.slice(0, 10)}`,
    row.customer,
    `${row.representative}\n${row.team}`,
    row.status.replaceAll("_", " "),
    money(row.amountCents),
  ];
}

function drawRegister(doc: PdfDoc, title: string, columns: PdfColumn[], records: string[][]) {
  const scale = `records / amounts in INR / dates in UTC`;
  openSection(doc, title, `${records.length} ${scale}`, true);
  drawRegisterHead(doc, columns);
  if (!records.length) {
    doc.page.drawText("No records match this selection.", {
      color: GRAY_600,
      font: doc.regular,
      size: 11,
      x: MARGIN + 6,
      y: doc.y - 24,
    });
    return;
  }
  records.forEach((record, index) => {
    const cells = columns.map((column, cell) =>
      wrapText(doc.regular, record[cell] ?? "", ROW_SIZE, column.width - 12),
    );
    const lines = Math.max(...cells.map((cell) => cell.length));
    let drawn = 0;
    while (drawn < lines) {
      if (capacity(doc) < 1) {
        openSection(doc, `${title} (continued)`, `Continued ${scale}`, true);
        drawRegisterHead(doc, columns);
      }
      const take = Math.min(capacity(doc), lines - drawn);
      drawRegisterBlock(doc, columns, cells, drawn, take, index % 2 === 0);
      drawn += take;
    }
  });
}

/** Lines of an 8pt register row that still fit above the stamped footer. */
function capacity(doc: PdfDoc) {
  return Math.floor((doc.y - BODY_BOTTOM - 6) / ROW_LINE);
}

function drawRegisterHead(doc: PdfDoc, columns: PdfColumn[]) {
  const height = 24;
  doc.page.drawRectangle({
    color: NAVY,
    height,
    width: CONTENT_WIDTH,
    x: MARGIN,
    y: doc.y - height,
  });
  let cursor = MARGIN;
  for (const column of columns) {
    const label = printable(column.header);
    const y = doc.y - 15;
    if (column.align === "right")
      drawRight(doc.page, label, cursor + column.width - 6, y, doc.bold, ROW_SIZE, WHITE);
    else
      doc.page.drawText(label, { color: WHITE, font: doc.bold, size: ROW_SIZE, x: cursor + 6, y });
    cursor += column.width;
  }
  doc.y -= height;
}

function drawRegisterBlock(
  doc: PdfDoc,
  columns: PdfColumn[],
  cells: string[][],
  offset: number,
  take: number,
  zebra: boolean,
) {
  const height = take * ROW_LINE + 6;
  if (zebra)
    doc.page.drawRectangle({
      color: BG_LIGHT,
      height,
      width: CONTENT_WIDTH,
      x: MARGIN,
      y: doc.y - height,
    });
  let cursor = MARGIN;
  columns.forEach((column, index) => {
    (cells[index] ?? []).slice(offset, offset + take).forEach((line, lineIndex) => {
      if (!line) return;
      const y = doc.y - 10 - lineIndex * ROW_LINE;
      if (column.align === "right")
        drawRight(doc.page, line, cursor + column.width - 6, y, doc.regular, ROW_SIZE, NAVY);
      else
        doc.page.drawText(line, {
          color: NAVY,
          font: doc.regular,
          size: ROW_SIZE,
          x: cursor + 6,
          y,
        });
    });
    cursor += column.width;
  });
  doc.y -= height;
}
