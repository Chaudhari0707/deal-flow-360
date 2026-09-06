import { describe, expect, test } from "bun:test";

import ExcelJS from "exceljs";
import {
  decodePDFRawStream,
  PDFArray,
  PDFDocument,
  type PDFRawStream,
  StandardFonts,
} from "pdf-lib";

import type { InvoiceDocument, ReportRow } from "@/features/billing/_types/documents";
import { invoicePdf, reportPdf, reportSpreadsheet } from "@/features/billing/documents";
import { wrapText } from "@/features/billing/pdf-layout";

const invoice: InvoiceDocument = {
  creditedCents: 0,
  customer: "Test ग्राहक 客户",
  dueAt: "2026-09-14",
  issuedAt: "2026-09-01",
  kind: "RECURRING",
  lines: [{ description: "Monthly support", quantity: 2, totalCents: 4600, unitPriceCents: 2300 }],
  number: "INV-TEST",
  paidCents: 0,
  status: "UNPAID",
  totalCents: 4600,
};
const rows: ReportRow[] = [
  {
    category: "Services",
    customer: '=HYPERLINK("https://example.com")',
    date: "2026-09-01",
    kind: "RECURRING",
    number: "INV-TEST",
    outstandingCents: 4600,
    paidCents: 0,
    status: "UNPAID",
    totalCents: 4600,
  },
];

function pageText(pdf: PDFDocument, index: number) {
  const contents = pdf.getPage(index).node.Contents();
  const objects = contents instanceof PDFArray ? contents.asArray() : [contents!];
  return objects
    .map((object) => {
      const stream = pdf.context.lookup(object) as PDFRawStream;
      const operators = new TextDecoder().decode(decodePDFRawStream(stream).decode());
      return [...operators.matchAll(/<([0-9a-f]+)>\s*Tj/gi)]
        .map((match) =>
          String.fromCharCode(...match[1]!.match(/../g)!.map((pair) => parseInt(pair, 16))),
        )
        .join(" ");
    })
    .join(" ");
}

describe("financial export artifacts", () => {
  test("report summary charts retain exact INR amounts and credit signs", async () => {
    const pdf = await PDFDocument.load(
      await reportPdf(
        [
          ...rows,
          {
            ...rows[0]!,
            number: "CN-TEST",
            kind: "credit",
            totalCents: 6000,
            paidCents: 0,
            outstandingCents: 0,
          },
        ],
        "Customer: Example / all dates",
        {
          quotes: [
            {
              id: "q",
              number: "Q-1",
              customer: "Example",
              representative: "Rep",
              team: "Sales",
              date: "2026-09-01",
              status: "DRAFT",
              kind: "QUOTE",
              amountCents: 4600,
            },
          ],
          orders: [],
          metrics: {
            quotesCreated: 1,
            ordersConfirmed: 0,
            orderedCents: 0,
            averageApprovalHours: null,
            completedApprovalCycles: 0,
            topUpsoldProduct: null,
          },
        },
      ),
    );
    expect(pdf.getTitle()).toBe("DealFlow360 | Sales and financial report");
    expect(pdf.getPage(0).getSize()).toEqual({ width: 842, height: 595 });
    const summary = pageText(pdf, 0);
    for (const label of [
      "NET BILLED",
      "Financial comparison",
      "Quotation status",
      "DRAFT",
      "INR 46.00",
      "INR 60.00",
      "-INR 14.00",
      "Page 1 of 5",
    ])
      expect(summary).toContain(label);
    expect(pageText(pdf, 1)).toContain("Customer: Example / all dates");
    expect(pageText(pdf, 2)).toContain("Q-1");
    expect(pageText(pdf, 3)).toContain("No records match this selection");
    expect(pageText(pdf, 4)).toContain("CN-TEST");
  });

  test("empty reports have explanatory charts and tables; oversized cells retain their ending", async () => {
    const empty = await PDFDocument.load(await reportPdf([], "All dates"));
    expect(pageText(empty, 0)).toContain("No matching activity to chart");
    expect(pageText(empty, 2)).toContain("No records match this selection");
    const long = await PDFDocument.load(
      await reportPdf(
        [
          {
            ...rows[0]!,
            customer: "Long customer ".repeat(1500) + "END-MARKER",
            number: "INV-LONG",
          },
          { ...rows[0]!, number: "INV-LAST" },
        ],
        "All dates",
      ),
    );
    const fullText = long
      .getPages()
      .map((_, index) => pageText(long, index))
      .join(" ");
    expect(fullText).toContain("END-MARKER");
    expect(fullText).toContain("INV-LAST");
    for (let index = 2; index < long.getPageCount(); index++) {
      expect(pageText(long, index)).toContain("Number / issue date");
      expect(pageText(long, index)).toContain(`Page ${index + 1} of ${long.getPageCount()}`);
    }
  });
  test("invoice is a real PDF with document metadata and non-Latin customer support", async () => {
    const bytes = await invoicePdf(invoice);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toBe("DealFlow360 | Invoice INV-TEST");
    expect(pdf.getCreator()).toBe("DealFlow360");
  });
  test("credit notes keep a distinct document title", async () => {
    const bytes = await invoicePdf({ ...invoice, kind: "credit" });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getTitle()).toBe("DealFlow360 | Credit Note INV-TEST");
    expect(pdf.getPageCount()).toBe(1);
  });
  test("wrapped invoice descriptions stay inside the description column", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const width = 247;
    const lines = wrapText(font, `Premium managed ${"support ".repeat(18)}retainer`, 9, width);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(font.widthOfTextAtSize(line, 9)).toBeLessThanOrEqual(width);
  });
  test("invoices with many line items paginate instead of clipping", async () => {
    const bytes = await invoicePdf({
      ...invoice,
      lines: Array.from({ length: 40 }, (_, index) => ({
        description: `Line ${index} ${"extended service description ".repeat(4)}`,
        quantity: 1,
        totalCents: 100,
        unitPriceCents: 100,
      })),
      subtotalCents: 4000,
      taxCents: 320,
      totalCents: 4320,
    });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    expect(pdf.getTitle()).toBe("DealFlow360 | Invoice INV-TEST");
  });
  test("long financial reports paginate rather than clipping rows", async () => {
    const bytes = await reportPdf(
      Array.from({ length: 80 }, (_, index) => ({ ...rows[0]!, number: `INV-${index}` })),
      "All dates",
    );
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getTitle()).toBe("DealFlow360 | Sales and financial report");
    expect(pdf.getPageCount()).toBeGreaterThan(2);
  });
  test("spreadsheet preserves numeric cents and treats customer input as a plain string", async () => {
    const bytes = await reportSpreadsheet(rows, "September 2026");
    expect(new TextDecoder().decode(bytes.slice(0, 2))).toBe("PK");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes.buffer as ArrayBuffer);
    const sheet = workbook.getWorksheet("Financial report")!;
    expect(sheet.getCell("A2").value).toBe("INV-TEST");
    expect(sheet.getCell("C2").value).toBe('=HYPERLINK("https://example.com")');
    expect(sheet.getCell("G2").value).toBe(46);
    expect(sheet.getCell("G1").value).toBe("Total INR");
    expect(sheet.getCell("I1").value).toBe("Outstanding INR");
    expect(sheet.getCell("I2").value).toBe(46);
    expect(workbook.getWorksheet("Filters")?.getCell("B1").value).toBe("September 2026");
  });
});
