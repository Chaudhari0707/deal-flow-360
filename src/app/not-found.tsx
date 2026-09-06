import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col justify-center p-6">
      <div className="border-t-2 border-foreground pt-6">
        <span aria-hidden className="block h-0.5 w-7 bg-ink-accent" />
        <h1 className="mt-4 text-3xl leading-[1.1] font-semibold tracking-tight text-foreground md:text-4xl">
          We couldn't find that page
        </h1>
        <p className="mt-3 max-w-[52ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
          The link may have changed or the item may no longer be available.
        </p>
        <div className="mt-7">
          <Button nativeButton={false} render={<Link href="/dashboard" />}>
            Back to workspace
          </Button>
        </div>
      </div>
    </main>
  );
}
