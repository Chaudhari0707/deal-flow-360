import { createAuth } from "@/lib/auth/create-auth";
import { db } from "@/lib/db/connection";

export const auth = createAuth(db);

export default auth;
