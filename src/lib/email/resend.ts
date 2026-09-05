import "server-only";

import { Resend } from "resend";

let client: Resend | undefined;

export function getResend() {
  const apiKey = Bun.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is required to send email");

  client ??= new Resend(apiKey);
  return client;
}
