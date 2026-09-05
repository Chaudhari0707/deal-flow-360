"use client";

import type { ReactNode } from "react";
import { SWRConfig } from "swr";

import { TooltipProvider } from "@/components/ui/tooltip";
import { HttpResponseError } from "@/lib/api/client";

const swrConfig = {
  dedupingInterval: 2_000,
  keepPreviousData: true,
  revalidateOnFocus: true,
  shouldRetryOnError(error: unknown) {
    return !(error instanceof HttpResponseError && error.status >= 400 && error.status < 500);
  },
};

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={swrConfig}>
      <TooltipProvider>{children}</TooltipProvider>
    </SWRConfig>
  );
}
