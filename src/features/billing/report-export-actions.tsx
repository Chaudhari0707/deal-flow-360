import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ReportExportActions({ enabled, url }: { enabled: boolean; url: string }) {
  return (
    <>
      {(
        [
          { format: "pdf", label: "PDF", name: "Download report PDF", variant: "outline" },
          { format: "xlsx", label: "Excel", name: "Download report Excel", variant: "default" },
        ] as const
      ).map((item) =>
        enabled ? (
          <Button
            key={item.format}
            variant={item.variant}
            nativeButton={false}
            render={<a aria-label={item.name} href={`${url}&format=${item.format}`} />}
          >
            <DownloadIcon />
            {item.label}
          </Button>
        ) : (
          <Button key={item.format} variant={item.variant} disabled aria-label={item.name}>
            <DownloadIcon />
            {item.label}
          </Button>
        ),
      )}
    </>
  );
}
