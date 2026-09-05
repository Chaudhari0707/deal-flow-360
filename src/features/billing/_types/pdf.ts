import type { PDFDocument, PDFFont, PDFImage, PDFPage } from "pdf-lib";

export interface PdfColumn {
  align?: "left" | "right";
  header: string;
  width: number;
}

export interface PdfDoc {
  bold: PDFFont;
  height: number;
  logo: PDFImage | null;
  page: PDFPage;
  pages: PDFPage[];
  pdf: PDFDocument;
  regular: PDFFont;
  width: number;
  y: number;
}
