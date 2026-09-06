import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Report export, rendered beside the masthead.
 *
 * Both formats share one quiet outline treatment: downloading a report is a secondary utility,
 * so the accent fill stays reserved for the actions that change state. The unavailable state
 * stays a real disabled button with no href — an anchor cannot be disabled, and
 * `billing-review.regression` asserts exactly one button and no navigable link here.
 */
export function ReportExportActions({
  enabled,
  format,
  url,
}: {
  enabled: boolean;
  format: "pdf" | "xlsx";
  url: string;
}) {
  const item =
    format === "pdf"
      ? { label: "Download PDF", name: "Download sales report PDF" }
      : { label: "Download Excel", name: "Download financial report Excel" };
  return enabled ? (
    <Button
      variant="outline"
      nativeButton={false}
      render={<a aria-label={item.name} href={`${url}&format=${format}`} />}
    >
      <DownloadIcon />
      {item.label}
    </Button>
  ) : (
    <Button variant="outline" disabled aria-label={item.name}>
      <DownloadIcon />
      {item.label}
    </Button>
  );
}
