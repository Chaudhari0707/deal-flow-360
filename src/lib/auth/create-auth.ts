import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";

import type { AuthDatabase } from "@/lib/auth/_types/database";
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

function buildAuth(database: AuthDatabase, baseURL: string, secret: string, provisioning = false) {
  return betterAuth({
    baseURL,
    database: drizzleAdapter(database, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: !provisioning,
    },
    plugins: provisioning ? [] : [nextCookies()],
    databaseHooks: {
      account: {
        update: {
          before: async (account, context) => {
            if (
              account.password &&
              context?.path === "/change-password" &&
              context.body?.newPassword === context.body?.currentPassword
            )
              throw new APIError("BAD_REQUEST", {
                message: "Choose a password different from your temporary password.",
              });
          },
          after: async (account, context) => {
            if (
              account.providerId === "credential" &&
              ["/change-password", "/reset-password"].includes(context?.path ?? "")
            ) {
              await database
                .update(schema.profiles)
                .set({ mustChangePassword: false })
                .where(eq(schema.profiles.userId, account.userId));
              await database
                .update(schema.customerInvitations)
                .set({ encryptedPayload: "" })
                .where(eq(schema.customerInvitations.userId, account.userId));
            }
          },
        },
      },
    },
    secret,
    trustedOrigins: trustedOrigins(baseURL),
  });
}

const authInstances = new WeakMap<object, ReturnType<typeof buildAuth>>();

export function createAuth(database: AuthDatabase, provisioning = false) {
  const existing = provisioning ? undefined : authInstances.get(database);
  if (existing) return existing;

  const baseURL = Bun.env.BETTER_AUTH_URL;
  const secret = Bun.env.BETTER_AUTH_SECRET;

  if (!baseURL) throw new Error("BETTER_AUTH_URL is required");
  if (!secret || secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters");
  }

  const auth = buildAuth(database, baseURL, secret, provisioning);
  if (!provisioning) authInstances.set(database, auth);
  return auth;
}
