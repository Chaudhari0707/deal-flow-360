"use client";

import { type ReactNode, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { LockKeyhole, LogOut } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { fetchJson } from "@/lib/swr/fetcher";

export function PortalShell({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function signOut() {
    setPending(true);
    setError("");
    try {
      await fetchJson("/api/v1/portal/logout", { method: "POST" });
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
    <div className="min-h-svh bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-4 px-4 md:px-8">
          <Link
            href="/portal"
            className="flex items-center gap-3 text-lg font-semibold tracking-tight"
          >
            <Image
              src="/logo.png"
              alt="DealFlow360"
              width={180}
              height={60}
              className="h-10 w-auto object-contain"
              priority
            />
            <Badge variant="outline" className="hidden sm:flex">
              Customer portal
            </Badge>
          </Link>
          <Button variant="outline" aria-label="Sign out" disabled={pending} onClick={signOut}>
            <LogOut />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
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
      <footer className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-8 text-xs text-muted-foreground">
        <LockKeyhole className="size-3.5" />
        Your quotes. Your conversations. One secure workspace.
      </footer>
    </div>
  );
}
