"use client";

import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HttpResponseError } from "@/lib/api/client";

const figures = [1, 2, 3, 4];
const registerRows = [1, 2, 3, 4, 5, 6];

/**
 * Fallback for `protected-surface`, `app/loading` and `app/error`, so its shape is the first
 * thing a route paints. It traces the editorial page — masthead, hairline-divided figure band,
 * register — rather than a grid of rounded tiles, so nothing reflows when content arrives.
 */
export function WorkspaceState({ error, retry }: { error?: unknown; retry?: () => void }) {
  if (error) {
    const denied = error instanceof HttpResponseError && error.status === 403;
    return (
      <Alert variant="destructive">
        <AlertTitle>{denied ? "Access restricted" : "Unable to load your workspace"}</AlertTitle>
        <AlertDescription>
          <span className="block max-w-[56ch] leading-relaxed">
            {denied
              ? "Your current role does not have access to this area."
              : "Check your connection and try again. Your saved work is safe."}
          </span>
          <div className="mt-5 flex flex-wrap gap-3">
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
    <div className="w-full" role="status" aria-label="Loading workspace">
      <div className="border-t-2 border-foreground pt-6">
        <span aria-hidden className="block h-0.5 w-7 bg-ink-accent" />
        <Skeleton className="mt-4 h-8 w-56 md:h-9 md:w-72" />
        <Skeleton className="mt-4 h-3.5 w-full max-w-[52ch]" />
      </div>
      <div className="mt-10 grid grid-cols-2 border-t border-border sm:grid-cols-4 sm:divide-x sm:divide-border">
        {figures.map((key) => (
          <div key={key} className="py-7 sm:px-8 sm:first:pl-0 sm:last:pr-0">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="mt-3 h-6 w-24" />
            <Skeleton className="mt-3 h-2.5 w-20" />
          </div>
        ))}
      </div>
      <div className="mt-12">
        <div className="flex items-baseline justify-between gap-8 border-b border-border pb-3">
          <Skeleton className="h-2.5 w-32" />
          <Skeleton className="h-2.5 w-24" />
        </div>
        {registerRows.map((key) => (
          <div key={key} className="flex items-center gap-6 border-b border-border py-4 sm:gap-10">
            <Skeleton className="h-3.5 w-24 shrink-0" />
            <Skeleton className="h-3.5 flex-1" />
            <Skeleton className="hidden h-3.5 w-28 sm:block" />
            <Skeleton className="h-3.5 w-16 shrink-0" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading workspace…</span>
    </div>
  );
}
