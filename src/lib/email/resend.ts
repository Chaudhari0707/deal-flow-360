import "server-only";

import { Resend } from "resend";

import { env } from "@/lib/env";

let client: Resend | undefined;

export function getResend() {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is required to send email");

  client ??= new Resend(apiKey);
  return client;
}
