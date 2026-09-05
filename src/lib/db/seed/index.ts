import { eq } from "drizzle-orm";

import { createAuth } from "@/lib/auth/create-auth";
import type { db } from "@/lib/db/connection";
import { user } from "@/lib/db/schema";
import { seedDemo } from "@/lib/db/seed/demo";

type Database = typeof db;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Seeder = (database: Transaction) => Promise<void>;

const seeders: Seeder[] = [];

async function seedCredentialUser(database: Database) {
  const email = Bun.env.SEED_AUTH_EMAIL ?? Bun.env.PLAYWRIGHT_USER_EMAIL;
  const password = Bun.env.SEED_AUTH_PASSWORD ?? Bun.env.PLAYWRIGHT_USER_PASSWORD;
  const name = Bun.env.SEED_AUTH_NAME ?? "Development User";

  if (!email && !password) return;
  if (!email || !password || password.length < 8) {
    throw new Error("Seed credentials require an email and password of at least 8 characters");
  }

  const existing = await database
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  if (existing.length > 0) return;

  await createAuth(database).api.signUpEmail({
    body: { email, name, password },
  });
}

export async function seedDatabase(database: Database) {
  await database.transaction(async (transaction) => {
    for (const seed of seeders) await seed(transaction);
  });
  await seedCredentialUser(database);
  if (Bun.env.DEMO_PASSWORD) await seedDemo(database);
}
