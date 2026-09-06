import type { InvoiceDocument } from "@/features/billing/_types/documents";
import type { PdfColumn, PdfDoc } from "@/features/billing/_types/pdf";
import {
  A4_PORTRAIT,
  BG_LIGHT,
  dateOnly,
  drawBrandBar,
  drawHLine,
  drawRight,
  drawTableHeader,
  drawTableRow,
  ensureSpace,
  GRAY_400,
  GRAY_600,
  GREEN,
  MARGIN,
  measureTableRow,
  NAVY,
  openPdf,
  printable,
  SKY,
  stampFooters,
  tableWidth,
  WHITE,
  wrapText,
} from "@/features/billing/pdf-layout";
import { invoiceOutstanding } from "@/features/billing/rules";
import { documentMoney as money } from "@/lib/money";

const LINE_COLUMNS: PdfColumn[] = [
  { header: "Description", width: 255 },
  { align: "right", header: "Qty", width: 50 },
  { align: "right", header: "Unit price", width: 105 },
  { align: "right", header: "Total", width: 105 },
];

export async function invoicePdf(invoice: InvoiceDocument): Promise<Uint8Array> {
  const isCredit = invoice.kind === "credit";
  const docLabel = isCredit ? "Credit Note" : "Invoice";
  const doc = await openPdf(`DealFlow360 | ${docLabel} ${invoice.number}`, A4_PORTRAIT);
  const paintChrome = (continued: boolean) => {
    drawBrandBar(doc, docLabel);
    if (!continued) return;
    doc.page.drawText(`${printable(invoice.number)} (continued)`, {
      color: GRAY_400,
      font: doc.regular,
      size: 9,
      x: MARGIN,
      y: doc.y,
    });
    doc.y -= 14;
    drawTableHeader(doc, LINE_COLUMNS, MARGIN);
  };

  paintChrome(false);
  drawIdentity(doc, invoice, docLabel);
  drawTableHeader(doc, LINE_COLUMNS, MARGIN);
  invoice.lines.forEach((line, index) => {
    const values = [
      line.description,
      String(line.quantity),
      money(line.unitPriceCents),
      money(line.totalCents),
    ];
    const height = measureTableRow(doc.regular, LINE_COLUMNS, values, 9);
    ensureSpace(doc, height, () => paintChrome(true));
    drawTableRow(doc, LINE_COLUMNS, values, MARGIN, { size: 9, zebra: index % 2 === 1 });
  });
  drawTotals(doc, invoice, isCredit, () => {
    drawBrandBar(doc, docLabel);
    doc.page.drawText(`${printable(invoice.number)} (continued)`, {
      color: GRAY_400,
      font: doc.regular,
      size: 9,
      x: MARGIN,
      y: doc.y,
    });
    doc.y -= 14;
  });
  stampFooters(
    doc,
    "Currency: INR. A credit note is not a cash refund. Fulfillment is tracked separately.",
  );
  return doc.pdf.save();
}

function drawIdentity(doc: PdfDoc, invoice: InvoiceDocument, docLabel: string) {
  doc.page.drawText(printable(invoice.number), {
    color: NAVY,
    font: doc.bold,
    size: 16,
    x: MARGIN,
    y: doc.y,
  });
  const issued = `Issued  ${dateOnly(invoice.issuedAt)}`;
  const due = `Due  ${dateOnly(invoice.dueAt)}`;
  drawRight(doc.page, issued, doc.width - MARGIN, doc.y + 2, doc.regular, 9, GRAY_400);
  drawRight(doc.page, due, doc.width - MARGIN, doc.y - 12, doc.regular, 9, GRAY_400);
  doc.y -= 28;

  const boxTop = doc.y + 12;
  const customerLines = wrapText(doc.bold, invoice.customer, 11, 300);
  const boxHeight = Math.max(52, 36 + customerLines.length * 13);
  doc.page.drawRectangle({
    color: BG_LIGHT,
    height: boxHeight,
    width: tableWidth(LINE_COLUMNS),
    x: MARGIN,
    y: boxTop - boxHeight,
  });
  doc.page.drawText("Bill to", {
    color: GRAY_400,
    font: doc.bold,
    size: 8,
    x: MARGIN + 8,
    y: boxTop - 14,
  });
  customerLines.forEach((line, index) => {
    if (line) {
      doc.page.drawText(line, {
        color: NAVY,
        font: doc.bold,
        size: 11,
        x: MARGIN + 8,
        y: boxTop - 30 - index * 13,
      });
    }
  });
  const meta = [`Type: ${printable(invoice.kind)}`];
  if (invoice.sourceNumber) meta.push(`Source: ${printable(invoice.sourceNumber)}`);
  const metaLine = wrapText(doc.regular, meta.join("   ·   "), 8, 300)[0] ?? "";
  if (metaLine) {
    doc.page.drawText(metaLine, {
      color: GRAY_600,
      font: doc.regular,
      size: 8,
      x: MARGIN + 8,
      y: boxTop - boxHeight + 10,
    });
  }

  const status = printable(invoice.status);
  const statusWidth = doc.bold.widthOfTextAtSize(status, 9);
  const statusColor = invoice.status === "PAID" ? GREEN : SKY;
  const statusX = doc.width - MARGIN - statusWidth - 16;
  doc.page.drawRectangle({
    color: statusColor,
    height: 16,
    width: statusWidth + 12,
    x: statusX,
    y: boxTop - 20,
  });
  doc.page.drawText(status, {
    color: WHITE,
    font: doc.bold,
    size: 9,
    x: statusX + 6,
    y: boxTop - 16,
  });
  doc.page.drawText(docLabel, {
    color: GRAY_400,
    font: doc.regular,
    size: 8,
    x: statusX,
    y: boxTop - 34,
  });
  doc.y = boxTop - boxHeight - 16;
}

function drawTotals(
  doc: PdfDoc,
  invoice: InvoiceDocument,
  isCredit: boolean,
  onNewPage: () => void,
) {
  const rows: { bold?: boolean; label: string; value: string }[] = [
    { label: "Subtotal", value: money(invoice.subtotalCents ?? invoice.totalCents) },
  ];
  if (invoice.taxCents != null) rows.push({ label: "Tax", value: money(invoice.taxCents) });
  rows.push({ label: "Payments", value: `- ${money(invoice.paidCents)}` });
  rows.push({ label: "Credits applied", value: `- ${money(invoice.creditedCents)}` });
  rows.push({
    bold: true,
    label: "Outstanding",
    value: money(isCredit ? 0 : invoiceOutstanding(invoice)),
  });
  ensureSpace(doc, 16 + rows.length * 16 + 8, onNewPage);
  doc.y -= 10;
  const labelX = doc.width - MARGIN - 210;
  const valueRight = doc.width - MARGIN;
  for (const row of rows) {
    const font = row.bold ? doc.bold : doc.regular;
    const size = row.bold ? 11 : 9;
    if (row.bold) drawHLine(doc.page, doc.y + 10, labelX, valueRight);
    doc.page.drawText(row.label, {
      color: row.bold ? NAVY : GRAY_600,
      font,
      size,
      x: labelX,
      y: doc.y,
    });
    drawRight(doc.page, row.value, valueRight, doc.y, font, size, row.bold ? NAVY : GRAY_600);
    doc.y -= row.bold ? 20 : 15;
  }
}
