import { describe, expect, test } from "bun:test";

import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";

import type { InvoiceDocument, ReportRow } from "@/features/billing/_types/documents";
import { invoicePdf, reportPdf, reportSpreadsheet } from "@/features/billing/documents";

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

describe("financial export artifacts", () => {
  test("invoice is a real PDF with document metadata and non-Latin customer support", async () => {
    const bytes = await invoicePdf(invoice);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toBe("DealFlow360 | Invoice INV-TEST");
    expect(pdf.getCreator()).toBe("DealFlow360");
  });
  test("long financial reports paginate rather than clipping rows", async () => {
    const bytes = await reportPdf(
      Array.from({ length: 80 }, (_, index) => ({ ...rows[0]!, number: `INV-${index}` })),
      "All dates",
    );
    const pdf = await PDFDocument.load(bytes);
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
    expect(sheet.getCell("I2").value).toBe(46);
    expect(workbook.getWorksheet("Filters")?.getCell("B1").value).toBe("September 2026");
  });
});
