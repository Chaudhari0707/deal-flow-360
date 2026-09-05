"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { SWRConfig } from "swr";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { fetchJson, HttpResponseError } from "@/lib/swr/fetcher";

const swrConfig = {
  dedupingInterval: 2_000,
  fetcher: fetchJson,
  keepPreviousData: true,
  revalidateOnFocus: true,
  shouldRetryOnError(error: unknown) {
    return !(error instanceof HttpResponseError && error.status >= 400 && error.status < 500);
  },
};

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="dealflow-theme"
    >
      <SWRConfig value={swrConfig}>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </SWRConfig>
    </ThemeProvider>
  );
}
