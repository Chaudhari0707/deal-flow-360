// A loopback-only Resend HTTP substitute for the isolated browser test server.
// Never mount these handlers in the application or return real credentials here.
import { assertDisposableDatabase, requireDatabaseUrl } from "./_lib/database-url";

assertDisposableDatabase(requireDatabaseUrl("DATABASE_URL"), "test");
const messages: { from: string; to: string; subject: string; text: string; key: string }[] = [];
const accepted = new Map<string, string>();
const attempts = new Set<string>();

Bun.serve({
  hostname: "127.0.0.1",
  port: 3103,
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health")
      return Response.json({ status: "ok" });
    if (request.method === "GET" && url.pathname === "/messages")
      return Response.json(messages.filter((m) => m.to === url.searchParams.get("to")));
    if (request.method !== "POST" || url.pathname !== "/emails")
      return new Response(null, { status: 404 });
    const body = (await request.json()) as {
      from: string;
      to: string | string[];
      subject: string;
      text: string;
    };
    const to = Array.isArray(body.to) ? body.to[0]! : body.to;
    const key = request.headers.get("idempotency-key") ?? "";
    if (to.startsWith("restricted-"))
      return Response.json(
        {
          name: "validation_error",
          message:
            "You can only send testing emails to your own email address (private@example.test).",
        },
        { status: 403 },
      );
    if (to.startsWith("retry-") && !attempts.has(key)) {
      attempts.add(key);
      return Response.json(
        { name: "application_error", message: "Synthetic provider unavailable" },
        { status: 500 },
      );
    }
    if (accepted.has(key)) return Response.json({ id: accepted.get(key) });
    const id = crypto.randomUUID();
    accepted.set(key, id);
    messages.push({ ...body, to, key });
    return Response.json({ id });
  },
});
