import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col justify-center p-6">
      <div className="border-t-2 border-foreground pt-6">
        <span aria-hidden className="block h-0.5 w-7 bg-ink-risk" />
        <h1 className="mt-4 text-3xl leading-[1.1] font-semibold tracking-tight text-foreground md:text-4xl">
          403 — Access denied
        </h1>
        <p className="mt-3 max-w-[52ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
          Your role cannot open this page.
        </p>
        <Link
          className="mt-7 inline-block text-sm font-medium text-ink-accent underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          href="/dashboard"
        >
          Return to overview
        </Link>
      </div>
    </main>
  );
}
