import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { PDFFont, PDFPage, RGB } from "pdf-lib";

import type { PdfColumn, PdfDoc } from "@/features/billing/_types/pdf";

export const NAVY = rgb(0.07, 0.14, 0.24);
export const GREEN = rgb(0.05, 0.6, 0.35);
export const SKY = rgb(0.01, 0.52, 0.78);
export const GRAY_600 = rgb(0.28, 0.33, 0.41);
export const GRAY_400 = rgb(0.58, 0.64, 0.72);
export const BORDER = rgb(0.89, 0.91, 0.94);
export const BG_LIGHT = rgb(0.97, 0.98, 0.99);
export const WHITE = rgb(1, 1, 1);
export const A4_PORTRAIT = { height: 842, width: 595 };
export const A4_LANDSCAPE = { height: 595, width: 842 };
export const MARGIN = 40;
export const FOOTER_RESERVE = 48;

export function money(cents: number) {
  return new Intl.NumberFormat("en-US", { currency: "USD", style: "currency" }).format(cents / 100);
}

/** Standard PDF fonts cannot encode arbitrary Unicode; escape unsupported codepoints visibly. */
export function printable(value: string): string {
  return value.replace(
    /[^\x20-\x7e\n]/gu,
    (character) => `[U+${character.codePointAt(0)?.toString(16).toUpperCase()}]`,
  );
}

export function wrapText(font: PDFFont, value: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of printable(value).split("\n")) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.split(/\s+/)) {
      for (const part of breakToken(font, word, size, maxWidth)) {
        const next = current ? `${current} ${part}` : part;
        if (current && font.widthOfTextAtSize(next, size) > maxWidth) {
          lines.push(current);
          current = part;
        } else current = next;
      }
    }
    lines.push(current);
  }
  return lines.length ? lines : [""];
}

function breakToken(font: PDFFont, token: string, size: number, maxWidth: number): string[] {
  if (maxWidth <= 0 || font.widthOfTextAtSize(token, size) <= maxWidth) return [token];
  const parts: string[] = [];
  let piece = "";
  for (const character of token) {
    const next = piece + character;
    if (piece && font.widthOfTextAtSize(next, size) > maxWidth) {
      parts.push(piece);
      piece = character;
    } else piece = next;
  }
  if (piece) parts.push(piece);
  return parts;
}

export function dateOnly(value: string): string {
  return printable(value.slice(0, 10));
}

export async function openPdf(
  title: string,
  size: { height: number; width: number },
): Promise<PdfDoc> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setCreator("DealFlow360");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([size.width, size.height]);
  return {
    bold,
    height: size.height,
    logo: await embedLogo(pdf),
    page,
    pages: [page],
    pdf,
    regular,
    width: size.width,
    y: size.height - 20,
  };
}

async function embedLogo(pdf: PDFDocument) {
  try {
    const root = import.meta.dir.replace(/[\\/]src[\\/]features[\\/]billing$/, "");
    const logoFile = Bun.file(`${root}/public/logo.png`);
    if (await logoFile.exists()) return await pdf.embedPng(await logoFile.arrayBuffer());
  } catch {
    /* Continue without logo */
  }
  return null;
}

export function newPage(doc: PdfDoc) {
  doc.page = doc.pdf.addPage([doc.width, doc.height]);
  doc.pages.push(doc.page);
  doc.y = doc.height - 20;
}

export function ensureSpace(doc: PdfDoc, needed: number, onNewPage: () => void) {
  if (doc.y - needed >= FOOTER_RESERVE) return;
  newPage(doc);
  onNewPage();
}

export function drawRight(
  page: PDFPage,
  text: string,
  right: number,
  y: number,
  font: PDFFont,
  size: number,
  color: RGB,
) {
  if (!text) return;
  page.drawText(text, { color, font, size, x: right - font.widthOfTextAtSize(text, size), y });
}

export function drawHLine(page: PDFPage, y: number, x1: number, x2: number) {
  page.drawLine({ color: BORDER, end: { x: x2, y }, start: { x: x1, y }, thickness: 0.5 });
}

export function drawBrandBar(doc: PdfDoc, rightLabel: string) {
  const band = 44;
  doc.page.drawRectangle({
    color: NAVY,
    height: band,
    width: doc.width,
    x: 0,
    y: doc.height - band,
  });
  if (doc.logo) {
    doc.page.drawImage(doc.logo, { height: 30, width: 112, x: MARGIN, y: doc.height - band + 7 });
  } else {
    doc.page.drawText("DealFlow360", {
      color: WHITE,
      font: doc.bold,
      size: 16,
      x: MARGIN,
      y: doc.height - 28,
    });
  }
  drawRight(
    doc.page,
    printable(rightLabel).toUpperCase(),
    doc.width - MARGIN,
    doc.height - 28,
    doc.bold,
    13,
    WHITE,
  );
  doc.y = doc.height - band - 18;
}

export function tableWidth(columns: PdfColumn[]) {
  return columns.reduce((sum, column) => sum + column.width, 0);
}

export function measureTableRow(font: PDFFont, columns: PdfColumn[], values: string[], size = 8) {
  const lineHeight = size + 3;
  const lines = Math.max(
    1,
    ...columns.map(
      (column, index) => wrapText(font, values[index] ?? "", size, column.width - 8).length,
    ),
  );
  return lines * lineHeight + 6;
}

export function drawTableHeader(doc: PdfDoc, columns: PdfColumn[], x: number) {
  const height = 16;
  const width = tableWidth(columns);
  doc.page.drawRectangle({ color: BG_LIGHT, height, width, x, y: doc.y - height });
  let cursor = x;
  for (const column of columns) {
    const label = printable(column.header);
    const textY = doc.y - 11;
    if (column.align === "right")
      drawRight(doc.page, label, cursor + column.width - 4, textY, doc.bold, 8, GRAY_400);
    else if (label)
      doc.page.drawText(label, {
        color: GRAY_400,
        font: doc.bold,
        size: 8,
        x: cursor + 4,
        y: textY,
      });
    cursor += column.width;
  }
  doc.y -= height;
  drawHLine(doc.page, doc.y, x, x + width);
}

export function drawTableRow(
  doc: PdfDoc,
  columns: PdfColumn[],
  values: string[],
  x: number,
  options?: { size?: number; zebra?: boolean },
) {
  const size = options?.size ?? 8;
  const lineHeight = size + 3;
  const height = measureTableRow(doc.regular, columns, values, size);
  const width = tableWidth(columns);
  if (options?.zebra)
    doc.page.drawRectangle({ color: BG_LIGHT, height, width, x, y: doc.y - height });
  let cursor = x;
  columns.forEach((column, index) => {
    wrapText(doc.regular, values[index] ?? "", size, column.width - 8).forEach(
      (line, lineIndex) => {
        if (!line) return;
        const textY = doc.y - 4 - size - lineIndex * lineHeight;
        if (column.align === "right") {
          drawRight(doc.page, line, cursor + column.width - 4, textY, doc.regular, size, NAVY);
        } else {
          doc.page.drawText(line, {
            color: NAVY,
            font: doc.regular,
            size,
            x: cursor + 4,
            y: textY,
          });
        }
      },
    );
    cursor += column.width;
  });
  doc.y -= height;
  drawHLine(doc.page, doc.y, x, x + width);
}

export function stampFooters(doc: PdfDoc, leftNote: string) {
  const note = printable(leftNote);
  const mark = "DealFlow360 - Sales Flow. Smarter.";
  for (const [index, page] of doc.pages.entries()) {
    const y = 26;
    drawHLine(page, y + 14, MARGIN, doc.width - MARGIN);
    const noteWidth = Math.min(300, doc.width - MARGIN * 2 - 220);
    const noteLine = wrapText(doc.regular, note, 7, noteWidth)[0] ?? "";
    if (noteLine) {
      page.drawText(noteLine, { color: GRAY_400, font: doc.regular, size: 7, x: MARGIN, y });
    }
    drawRight(
      page,
      `${mark}  ·  Page ${index + 1} of ${doc.pages.length}`,
      doc.width - MARGIN,
      y,
      doc.regular,
      7,
      GRAY_400,
    );
  }
}
