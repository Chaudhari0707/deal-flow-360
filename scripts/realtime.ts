import type { ServerWebSocket } from "bun";

import { startBillingScheduler } from "@/features/billing/scheduler";
import { inventorySnapshot } from "@/features/inventory/queries";
import { trustedOrigins } from "@/lib/auth/create-auth";
import { requireActor } from "@/server/access";

interface StockSocketData {
  request: Request;
}

const port = Number(Bun.env.REALTIME_PORT ?? 3101);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("REALTIME_PORT must be an integer between 1024 and 65535");
const clients = new Set<ServerWebSocket<StockSocketData>>();
let previous = "";
let reading = false;
const billing = Bun.env.AUTOMATIC_BILLING === "true" ? startBillingScheduler() : null;
const server = Bun.serve<StockSocketData>({
  hostname: "127.0.0.1",
  port,
  async fetch(request, server) {
    const url = new URL(request.url);
    if (url.pathname === "/health")
      return Response.json({
        status: "ok",
        clients: clients.size,
        billing: billing?.state ?? { enabled: false },
      });
    if (url.pathname !== "/stock") return new Response("Not found", { status: 404 });
    const origin = request.headers.get("origin");
    const baseURL = Bun.env.BETTER_AUTH_URL;
    if (!origin || !baseURL || !trustedOrigins(baseURL).includes(origin))
      return new Response("Origin not allowed", { status: 403 });
    try {
      await requireActor(request, ["admin", "ops", "manager", "rep"]);
      if (server.upgrade(request, { data: { request } })) return;
      return new Response("WebSocket upgrade required", { status: 426 });
    } catch {
      return new Response("Not authorized", { status: 401 });
    }
  },
  websocket: {
    idleTimeout: 60,
    sendPings: true,
    async open(socket) {
      clients.add(socket);
      socket.subscribe("stock");
      try {
        socket.send(
          JSON.stringify({ type: "stock.snapshot", data: await inventorySnapshot(0, 1000) }),
        );
      } catch {
        socket.close(1011, "Stock snapshot unavailable");
      }
    },
    message() {},
    close(socket) {
      clients.delete(socket);
    },
  },
});

// Poll the authoritative database after commit; do not publish from uncommitted transactions.
// A reconnect always gets a full snapshot, including revisions, before incremental refreshes.
setInterval(async () => {
  if (reading || clients.size === 0) return;
  reading = true;
  try {
    const data = await inventorySnapshot(0, 1000);
    const fingerprint = JSON.stringify(data);
    if (fingerprint !== previous) {
      server.publish("stock", JSON.stringify({ type: "stock.snapshot", data }));
      previous = fingerprint;
    }
  } catch {
    console.error("Stock feed refresh failed; connected clients will retry");
  } finally {
    reading = false;
  }
}, 1000);

setInterval(async () => {
  for (const socket of clients) {
    try {
      await requireActor(socket.data.request, ["admin", "ops", "manager", "rep"]);
    } catch {
      socket.close(1008, "Session expired or access revoked");
    }
  }
}, 30_000);
console.log(`Stock WebSocket listening locally on port ${port}`);
