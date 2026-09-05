import type { db } from "@/lib/db/connection";

export type Database = typeof db;
export type DbTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
