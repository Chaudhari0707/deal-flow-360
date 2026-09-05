import Image from "next/image";

import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  height?: number;
  priority?: boolean;
  width?: number;
};

export function BrandLogo({
  className,
  height = 60,
  priority = false,
  width = 180,
}: BrandLogoProps) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <Image
        src="/logo.png"
        alt="DealFlow360"
        width={width}
        height={height}
        className="h-auto max-h-10 w-auto object-contain"
        priority={priority}
      />
    </div>
  );
}
