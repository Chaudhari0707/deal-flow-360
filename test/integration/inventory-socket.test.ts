import { expect, test } from "bun:test";

import { eq } from "drizzle-orm";

import { restock } from "@/features/inventory/mutations";
import type { inventorySnapshot } from "@/features/inventory/queries";
import { createAuth } from "@/lib/auth/create-auth";
import { db } from "@/lib/db/connection";
import {
  auditEntries,
  products,
  profiles,
  stockMovements,
  stocks,
  user,
  warehouses,
} from "@/lib/db/schema";
import type { Actor } from "@/lib/domain/_types/domain";

// The application includes lib.dom, which wins over Bun's conditional global overload.
// This test runs in Bun and uses its documented, typed cookie/header constructor.
declare const WebSocket: {
  new (url: string, options: Bun.WebSocketOptions): globalThis.WebSocket;
};

async function snapshot(socket: WebSocket, productId: string, onHand: number) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("Committed stock snapshot was not received"));
    }, 4000);
    socket.addEventListener(
      "error",
      () => {
        clearTimeout(timeout);
        reject(new Error("Stock socket connection failed"));
      },
      { once: true },
    );
    const onMessage = (message: MessageEvent) => {
      const event = JSON.parse(String(message.data)) as {
        data: Awaited<ReturnType<typeof inventorySnapshot>>;
        type: string;
      };
      if (
        event.type === "stock.snapshot" &&
        event.data.stocks.some((s) => s.productId === productId && s.onHand === onHand)
      ) {
        clearTimeout(timeout);
        socket.removeEventListener("message", onMessage);
        resolve();
      }
    };
    socket.addEventListener("message", onMessage);
  });
}

test("real socket authenticates, delivers committed restock, and reloads latest state on reconnect", async () => {
  const id = crypto.randomUUID();
  const auth = createAuth(db);
  const email = `socket-${id}@example.com`;
  const password = `Test-${id}`;
  const signup = await auth.api.signUpEmail({ body: { email, password, name: "Socket Operator" } });
  await db.insert(profiles).values({ userId: signup.user.id, role: "ops" });
  const login = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
  const cookie = login.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  const actor: Actor = {
    customerId: null,
    email,
    id: signup.user.id,
    name: "Socket Operator",
    role: "ops",
  };
  await db.insert(products).values({
    id,
    name: "Socket Stock",
    category: "Hardware",
    priceCents: 100,
    costCents: 50,
    stockable: true,
  });
  await db.insert(warehouses).values({ id, name: "Socket Warehouse", shippingWeight: 100 });
  await db.insert(stocks).values({ id, productId: id, warehouseId: id, onHand: 1 });
  const server = Bun.spawn(["bun", "run", "scripts/realtime.ts"], {
    cwd: import.meta.dir.replace(/\/test\/integration$/, ""),
    env: {
      ...Object.fromEntries(
        Object.entries(Bun.env).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      ),
      REALTIME_PORT: "43101",
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const sockets: WebSocket[] = [];
  try {
    const reader = server.stdout.getReader();
    const started = await Promise.race([
      reader.read(),
      server.exited.then(() => {
        throw new Error("Socket test server exited before startup");
      }),
    ]);
    reader.releaseLock();
    expect(new TextDecoder().decode(started.value)).toContain("Stock WebSocket listening");
    const origin = Bun.env.BETTER_AUTH_URL!;
    expect((await fetch("http://127.0.0.1:43101/stock", { headers: { origin } })).status).toBe(401);
    expect(
      (
        await fetch("http://127.0.0.1:43101/stock", {
          headers: { origin: "https://untrusted.example", cookie },
        })
      ).status,
    ).toBe(403);
    const socket = new WebSocket("ws://127.0.0.1:43101/stock", { headers: { cookie, origin } });
    sockets.push(socket);
    await snapshot(socket, id, 1);
    const changed = snapshot(socket, id, 9);
    await restock(
      {
        operationKey: crypto.randomUUID(),
        productId: id,
        quantity: 8,
        reason: "Socket receipt",
        warehouseId: id,
      },
      actor,
    );
    await changed;
    socket.close();
    const reconnected = new WebSocket("ws://127.0.0.1:43101/stock", {
      headers: { cookie, origin },
    });
    sockets.push(reconnected);
    await snapshot(reconnected, id, 9);
    await auth.api.signOut({ headers: new Headers({ cookie }) });
    expect(
      (await fetch("http://127.0.0.1:43101/stock", { headers: { cookie, origin } })).status,
    ).toBe(401);
  } finally {
    for (const socket of sockets) socket.close();
    server.kill();
    await server.exited;
    await db.transaction(async (tx) => {
      await tx.delete(stockMovements).where(eq(stockMovements.productId, id));
      await tx.delete(stocks).where(eq(stocks.id, id));
      await tx.delete(products).where(eq(products.id, id));
      await tx.delete(warehouses).where(eq(warehouses.id, id));
      await tx.delete(auditEntries).where(eq(auditEntries.actorId, actor.id));
      await tx.delete(user).where(eq(user.id, actor.id));
    });
  }
}, 10000);
