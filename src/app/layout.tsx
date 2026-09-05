import "@/app/globals.css";

import type { ReactNode } from "react";
import type { Metadata } from "next";

import { AppProviders } from "@/components/providers/app-providers";

export const metadata: Metadata = {
  title: { default: "DealFlow360", template: "%s · DealFlow360" },
  description: "One connected workspace, from the first quote to recurring revenue.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
