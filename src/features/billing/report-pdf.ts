import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

import type { ReportRow } from "@/features/billing/_types/documents";
import type { SalesReport } from "@/features/billing/_types/reports";
import { documentMoney as money } from "@/lib/money";

const ink = rgb(0.08, 0.16, 0.25);
const muted = rgb(0.34, 0.4, 0.46);
const teal = rgb(0.02, 0.47, 0.43);
const blue = rgb(0.08, 0.42, 0.69);
const pale = rgb(0.95, 0.97, 0.98);
const border = rgb(0.85, 0.89, 0.91);
const white = rgb(1, 1, 1);
const clean = (value: string) =>
  value.replace(
    /[^\x20-\x7e\n]/gu,
    (character) => `[U+${character.codePointAt(0)!.toString(16).toUpperCase()}]`,
  );

/** Vector charts and paginated tables use exactly the filtered export records. */
export async function reportPdf(rows: ReportRow[], filterDescription: string, sales?: SalesReport) {
  const pdf = await PDFDocument.create();
  pdf.setTitle("DealFlow360 | Sales and financial report");
  pdf.setCreator("DealFlow360");
  pdf.setSubject(
    "Executive summary, financial comparison, quotation status and detailed records (INR)",
  );
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const generated = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
  let page = pdf.addPage([842, 595]);
  let y = 492;
  const text = (value: string, x: number, top: number, size = 10, strong = false, color = ink) => {
    page.drawText(clean(value), { x, y: top, size, font: strong ? bold : regular, color });
  };
  const wrap = (value: string, width: number, size = 9) => {
    const lines: string[] = [];
    let line = "";
    for (const character of clean(value)) {
      if (character === "\n") {
        lines.push(line);
        line = "";
      } else if (regular.widthOfTextAtSize(line + character, size) > width) {
        const boundary = line.lastIndexOf(" ");
        lines.push(boundary > 0 ? line.slice(0, boundary) : line);
        line = ((boundary > 0 ? line.slice(boundary + 1) : "") + character).trimStart();
      } else line += character;
    }
    lines.push(line);
    return lines;
  };
  const header = (title: string, section: string) => {
    page.drawRectangle({ x: 0, y: 0, width: 842, height: 595, color: white });
    page.drawRectangle({ x: 0, y: 579, width: 842, height: 16, color: teal });
    text("DEALFLOW360", 36, 547, 12, true, teal);
    text("SALES INTELLIGENCE  /  INR", 605, 547, 10, true, muted);
    text(title, 36, 514, 23, true);
    text(section, 36, 494, 9, false, muted);
    y = 469;
  };
  const newPage = (title: string, section: string) => {
    page = pdf.addPage([842, 595]);
    header(title, section);
  };
  header(
    "Sales & financial report",
    "Selected records only. Financial and sales cohorts use their own dates.",
  );

  const credits = rows
    .filter((row) => row.kind === "credit")
    .reduce((sum, row) => sum + row.totalCents, 0);
  const invoiced = rows
    .filter((row) => row.kind !== "credit")
    .reduce((sum, row) => sum + row.totalCents, 0);
  const paid = rows.reduce((sum, row) => sum + row.paidCents, 0);
  const outstanding = rows.reduce((sum, row) => sum + row.outstandingCents, 0);
  for (const [index, metric] of [
    ["NET BILLED", invoiced - credits],
    ["PAYMENTS COLLECTED", paid],
    ["OUTSTANDING", outstanding],
  ].entries()) {
    const x = 36 + index * 261;
    page.drawRectangle({ x, y: 384, width: 248, height: 84, color: pale });
    text(String(metric[0]), x + 14, 443, 9, true, muted);
    const value = money(Number(metric[1]));
    const size = Math.min(23, 218 / bold.widthOfTextAtSize(value, 1));
    text(value, x + 14, 409, size, true);
  }

  const bars = (
    title: string,
    entries: [string, number][],
    x: number,
    width: number,
    monetary: boolean,
  ) => {
    text(title, x, 353, 13, true);
    if (!entries.length || entries.every((entry) => entry[1] === 0)) {
      text("No matching activity to chart.", x, 314, 10, false, muted);
      return;
    }
    const max = Math.max(1, ...entries.map((entry) => Math.abs(entry[1])));
    const chartX = x + 120;
    const chartWidth = width - 130;
    const hasNegative = entries.some((entry) => entry[1] < 0);
    const origin = chartX + (hasNegative ? chartWidth / 2 : 0);
    const scale = (hasNegative ? chartWidth / 2 : chartWidth) / max;
    page.drawLine({
      start: { x: origin, y: 153 },
      end: { x: origin, y: 335 },
      color: border,
      thickness: 1,
    });
    entries.forEach(([label, value], index) => {
      const top = 326 - index * 34;
      text(label, x, top, 9, false, muted);
      const length = Math.abs(value) * scale;
      if (length > 0)
        page.drawRectangle({
          x: value < 0 ? origin - length : origin,
          y: top - 14,
          width: length,
          height: 7,
          color: value < 0 ? muted : monetary ? teal : blue,
        });
      const valueLabel = monetary ? money(value) : String(value);
      text(valueLabel, x + width - regular.widthOfTextAtSize(valueLabel, 8), top, 8, true);
    });
  };
  bars(
    "Financial comparison (INR)",
    [
      ["Invoiced", invoiced],
      ["Credit notes", credits],
      ["Net billed", invoiced - credits],
      ["Collected", paid],
      ["Outstanding", outstanding],
    ],
    36,
    365,
    true,
  );
  const counts = new Map<string, number>();
  for (const quote of sales?.quotes ?? [])
    counts.set(quote.status, (counts.get(quote.status) ?? 0) + 1);
  const statuses = [...counts].sort((a, b) => b[1] - a[1]);
  const plotted: [string, number][] = statuses
    .slice(0, 4)
    .map(([status, count]) => [status.replaceAll("_", " "), count]);
  if (statuses.length > 4)
    plotted.push(["OTHER STATUSES", statuses.slice(4).reduce((sum, entry) => sum + entry[1], 0)]);
  bars("Quotation status (count)", plotted, 437, 369, false);
  text("Credits reduce net billed; these amounts are not additive.", 36, 137, 8, false, muted);
  text("Status counts are not a conversion funnel.", 437, 137, 8, false, muted);
  page.drawRectangle({ x: 36, y: 64, width: 770, height: 52, color: pale });
  text(
    sales
      ? `${sales.metrics.quotesCreated} QUOTES  /  ${sales.metrics.ordersConfirmed} CONFIRMED ORDERS`
      : "No sales dataset supplied",
    50,
    95,
    10,
    true,
  );
  text(
    sales
      ? `Ordered value: ${money(sales.metrics.orderedCents)}`
      : `${rows.length} financial records in the selection`,
    50,
    77,
    9,
  );
  text(
    sales?.metrics.averageApprovalHours == null
      ? "Approval time: no completed cycles"
      : `Average approval: ${sales.metrics.averageApprovalHours.toFixed(2)} hours`,
    437,
    95,
    10,
    true,
  );
  text(`${sales?.metrics.completedApprovalCycles ?? 0} completed approval cycles`, 437, 77, 9);

  newPage("Report scope & interpretation", "Read alongside the charts and detail tables.");
  const paragraph = (value: string) => {
    for (const line of wrap(value, 760, 10)) {
      if (y < 65) newPage("Report scope (continued)", "Selection and reporting conventions");
      text(line, 36, y, 10);
      y -= 15;
    }
    y -= 14;
  };
  paragraph(`Generated: ${generated}`);
  paragraph(`Active filters: ${filterDescription}`);
  paragraph(
    "All amounts are INR. Dates are UTC. Quote/order charts use creation dates; financial records use invoice/credit issue dates. Payment status filters financial records only. Product/category filters select whole records with a matching line.",
  );
  paragraph(
    "Credit totals are positive in the register and subtracted from invoiced amounts for net billed. A credit is not a cash refund. Collected payments and outstanding balances describe the selected issued documents, not cash movements during the date range.",
  );
  if (sales)
    paragraph(
      sales.metrics.topUpsoldProduct
        ? `Top upsold product: ${sales.metrics.topUpsoldProduct.name} / ${sales.metrics.topUpsoldProduct.quantity} confirmed units.`
        : "Top upsold product: no confirmed upsells in this selection.",
    );
  paragraph(
    "Charts display exact values next to each bar. Negative net billing extends left of zero. Where more than four quotation statuses exist, the remaining counts are grouped as Other statuses. Full records follow, with repeated column headings and page numbers.",
  );

  const table = (title: string, headings: string[], widths: number[], records: string[][]) => {
    const tableHeader = () => {
      page.drawRectangle({ x: 36, y: y - 24, width: 770, height: 26, color: ink });
      let x = 36;
      headings.forEach((label, index) => {
        text(label, x + 6, y - 14, 8, true, white);
        x += widths[index]!;
      });
      y -= 26;
    };
    newPage(title, `${records.length} records / amounts in INR / dates in UTC`);
    tableHeader();
    if (!records.length) {
      text("No records match this selection.", 42, y - 28, 11, false, muted);
      return;
    }
    records.forEach((record, rowIndex) => {
      const cells = record.map((cell, index) => wrap(cell, widths[index]! - 12, 8));
      const count = Math.max(...cells.map((cell) => cell.length));
      let offset = 0;
      while (offset < count) {
        if (y < 90) {
          newPage(`${title} (continued)`, "Continued records / amounts in INR / dates in UTC");
          tableHeader();
        }
        const take = Math.min(count - offset, Math.floor((y - 65 - 12) / 11));
        const height = take * 11 + 12;
        page.drawRectangle({
          x: 36,
          y: y - height,
          width: 770,
          height,
          color: rowIndex % 2 ? white : pale,
        });
        let x = 36;
        cells.forEach((cell, index) => {
          cell
            .slice(offset, offset + take)
            .forEach((line, lineIndex) =>
              text(
                line,
                headings[index]!.includes("(INR)")
                  ? x + widths[index]! - 6 - regular.widthOfTextAtSize(line, 8)
                  : x + 6,
                y - 14 - lineIndex * 11,
                8,
              ),
            );
          x += widths[index]!;
        });
        y -= height;
        offset += take;
      }
    });
  };
  if (sales)
    for (const [title, records] of [
      ["Quotation register", sales.quotes],
      ["Confirmed order register", sales.orders],
    ] as const) {
      table(
        title,
        ["Number / date", "Customer", "Representative / team", "Status", "Amount (INR)"],
        [150, 180, 190, 110, 140],
        records.map((row) => [
          `${row.number}\n${row.date.slice(0, 10)}`,
          row.customer,
          `${row.representative}\n${row.team}`,
          row.status.replaceAll("_", " "),
          money(row.amountCents),
        ]),
      );
    }
  table(
    "Financial register",
    [
      "Number / issue date",
      "Customer / category",
      "Kind / status",
      "Total (INR)",
      "Paid (INR)",
      "Outstanding (INR)",
    ],
    [140, 180, 120, 110, 110, 110],
    rows.map((row) => [
      `${row.number}\n${row.date.slice(0, 10)}`,
      `${row.customer}\n${row.category}`,
      `${row.kind}\n${row.status}`,
      money(row.totalCents),
      money(row.paidCents),
      money(row.outstandingCents),
    ]),
  );
  for (const [index, sheet] of pdf.getPages().entries()) {
    page = sheet;
    page.drawLine({
      start: { x: 36, y: 44 },
      end: { x: 806, y: 44 },
      color: border,
      thickness: 0.5,
    });
    text(`DealFlow360  |  Internal report  |  ${generated}`, 36, 28, 8, false, muted);
    text(`Page ${index + 1} of ${pdf.getPageCount()}`, 726, 28, 8, false, muted);
  }
  return pdf.save();
}
