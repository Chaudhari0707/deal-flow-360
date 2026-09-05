import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import * as schema from "@/lib/db/schema";

export function trustedOrigins(baseURL: string): string[] {
  const configured = new URL(baseURL);
  const origins = new Set([configured.origin]);

  if (configured.hostname === "localhost" || configured.hostname === "127.0.0.1") {
    const alias = new URL(configured.origin);
    alias.hostname = configured.hostname === "localhost" ? "127.0.0.1" : "localhost";
    origins.add(alias.origin);
  }

  return [...origins];
}

export function createAuth(database: PostgresJsDatabase<typeof schema>) {
  const baseURL = Bun.env.BETTER_AUTH_URL;
  const secret = Bun.env.BETTER_AUTH_SECRET;

  if (!baseURL) throw new Error("BETTER_AUTH_URL is required");
  if (!secret || secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters");
  }

  return betterAuth({
    baseURL,
    database: drizzleAdapter(database, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
    },
    plugins: [nextCookies()],
    secret,
    trustedOrigins: trustedOrigins(baseURL),
  });
}
