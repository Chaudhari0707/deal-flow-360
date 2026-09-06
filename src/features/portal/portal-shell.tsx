"use client";

import { type ReactNode, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { LogOut } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/features/shell/theme-toggle";
import { apiClient, apiData } from "@/lib/api/client";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

const eyebrow = "text-[0.6875rem] font-medium tracking-[0.16em] uppercase";

export function PortalShell({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function signOut() {
    setPending(true);
    setError("");
    try {
      apiData(await apiClient.api.v1.portal.logout.post());
      const result = await authClient.signOut();
      if (result.error) throw new Error("Sign out failed");
      window.location.assign("/login");
    } catch {
      setError("Unable to sign out. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="min-h-svh bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-8">
          <Link href="/portal" className="flex items-center gap-4">
            <Image
              src="/logo.png"
              alt="DealFlow360"
              width={180}
              height={60}
              className="h-8 w-auto object-contain"
              priority
            />
            <span aria-hidden className="hidden h-5 w-px bg-border sm:block" />
            <span className={cn(eyebrow, "hidden text-muted-foreground sm:inline")}>
              Customer portal
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" aria-label="Sign out" disabled={pending} onClick={signOut}>
              <LogOut />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:px-8 md:py-12">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {children}
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 md:px-8">
        <p className="border-t border-border pt-5 text-xs text-muted-foreground">
          Your quotes. Your conversations. One secure workspace.
        </p>
      </footer>
    </div>
  );
}
