import { beforeAll, describe, expect, mock, test } from "bun:test";

import { eq } from "drizzle-orm";

import { createAuth } from "@/lib/auth/create-auth";
import { db } from "@/lib/db/connection";
import { customers } from "@/lib/db/schema";
mock.module("resend", () => ({
  Resend: class {
    emails = { send: async () => ({ data: { id: crypto.randomUUID() }, error: null }) };
  },
}));
const { api } = await import("@/server/api");

const email = `origin-${crypto.randomUUID()}@example.com`;
const password = `Origin-${crypto.randomUUID()}`;
const configured = new URL(Bun.env.BETTER_AUTH_URL!);
const canonicalOrigin = configured.origin;
const alternate = new URL(canonicalOrigin);
alternate.hostname = configured.hostname === "localhost" ? "127.0.0.1" : "localhost";
const wrongPort = new URL(canonicalOrigin);
wrongPort.port = String(
  Number(configured.port || (configured.protocol === "https:" ? 443 : 80)) + 1,
);
const auth = createAuth(db);
let cookie: string;

async function signIn(origin: string) {
  return auth.handler(
    new Request(`${canonicalOrigin}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ email, password }),
    }),
  );
}

beforeAll(async () => {
  if (!new URL(Bun.env.DATABASE_URL!).pathname.endsWith("_test"))
    throw new Error("Origin tests require a dedicated _test database");
  if (!["localhost", "127.0.0.1"].includes(configured.hostname))
    throw new Error("Origin integration tests require a configured loopback host");
  await auth.api.signUpEmail({ body: { email, name: "Origin compatibility fixture", password } });
  const response = await signIn(canonicalOrigin);
  expect(response.status).toBe(200);
  cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  expect(cookie.length).toBeGreaterThan(0);
});

describe("real credentials and application origin compatibility", () => {
  test("canonical and alternate loopback origins can sign in and persist authorized mutations", async () => {
    for (const origin of [canonicalOrigin, alternate.origin]) {
      const signedIn = await signIn(origin);
      expect(signedIn.status).toBe(200);
      const sessionCookie = signedIn.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      const name = `Origin customer ${crypto.randomUUID()}`;
      const response = await api.handle(
        new Request(`${origin}/api/v1/customers`, {
          method: "POST",
          headers: { "content-type": "application/json", cookie: sessionCookie, origin },
          body: JSON.stringify({
            email: `customer-${crypto.randomUUID()}@example.com`,
            name,
            tier: "Bronze",
          }),
        }),
      );
      expect(response.status).toBe(200);
      const created = (await response.json()) as { id: string };
      const [persisted] = await db.select().from(customers).where(eq(customers.id, created.id));
      expect(persisted?.name).toBe(name);
    }
  });

  test("a genuine session cannot mutate with missing, foreign or wrong-port origins", async () => {
    for (const origin of [undefined, "https://foreign.example", wrongPort.origin]) {
      const email = `blocked-${crypto.randomUUID()}@example.com`;
      const response = await api.handle(
        new Request(`${canonicalOrigin}/api/v1/customers`, {
          method: "POST",
          headers: { "content-type": "application/json", cookie, ...(origin ? { origin } : {}) },
          body: JSON.stringify({ email, name: "Rejected origin customer", tier: "Bronze" }),
        }),
      );
      expect(response.status).toBe(403);
      expect(await db.select().from(customers).where(eq(customers.email, email))).toHaveLength(0);
    }
  });
});
