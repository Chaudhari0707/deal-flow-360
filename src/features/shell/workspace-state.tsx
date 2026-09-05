"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HttpResponseError } from "@/lib/api/client";

export function WorkspaceState({ error, retry }: { error?: unknown; retry?: () => void }) {
  if (error) {
    const denied = error instanceof HttpResponseError && error.status === 403;
    return (
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>{denied ? "Access restricted" : "Unable to load your workspace"}</AlertTitle>
        <AlertDescription>
          {denied
            ? "Your current role does not have access to this area."
            : "Check your connection and try again. Your saved work is safe."}
          <div className="mt-3 flex gap-2">
            {retry && (
              <Button variant="outline" onClick={retry}>
                Try again
              </Button>
            )}
            <Button nativeButton={false} variant="outline" render={<Link href="/login" />}>
              Sign in
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <div className="space-y-6" role="status" aria-label="Loading workspace">
      <Skeleton className="h-9 w-56" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((key) => (
          <Skeleton key={key} className="h-36 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 w-full rounded-xl" />
      <span className="sr-only">Loading workspace…</span>
    </div>
  );
}
