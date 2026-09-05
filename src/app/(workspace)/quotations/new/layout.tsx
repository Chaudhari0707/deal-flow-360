import type { ReactNode } from "react";

import { ProtectedSurface } from "@/features/shell/protected-surface";

export default function SurfaceLayout({ children }: { children: ReactNode }) {
  return <ProtectedSurface permission="quoteWrite">{children}</ProtectedSurface>;
}
