import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">403 — Access denied</h1>
      <p className="my-4">Your role cannot open this page.</p>
      <Link className="underline" href="/dashboard">
        Return to overview
      </Link>
    </main>
  );
}
