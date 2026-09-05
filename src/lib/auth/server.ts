import "server-only";

import { createAuth } from "@/lib/auth/create-auth";
import { db } from "@/lib/db/client";

export const auth = createAuth(db);
