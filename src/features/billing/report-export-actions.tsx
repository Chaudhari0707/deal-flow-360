import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

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
      ? { label: "Download PDF", name: "Download sales report PDF", variant: "outline" as const }
      : {
          label: "Download Excel",
          name: "Download financial report Excel",
          variant: "default" as const,
        };
  return enabled ? (
    <Button
      variant={item.variant}
      nativeButton={false}
      render={<a aria-label={item.name} href={`${url}&format=${format}`} />}
    >
      <DownloadIcon />
      {item.label}
    </Button>
  ) : (
    <Button variant={item.variant} disabled aria-label={item.name}>
      <DownloadIcon />
      {item.label}
    </Button>
  );
}
