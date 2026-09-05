import { DomainError } from "@/server/errors";

async function payloadKey() {
  if (!Bun.env.BETTER_AUTH_SECRET || Bun.env.BETTER_AUTH_SECRET.length < 32)
    throw new DomainError("Email access requires configured authentication", 503);
  const key = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(Bun.env.BETTER_AUTH_SECRET!),
  );
  return crypto.subtle.importKey("raw", key, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function seal(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await payloadKey(),
    new TextEncoder().encode(value),
  );
  return `${Buffer.from(iv).toString("base64")}.${Buffer.from(bytes).toString("base64")}`;
}
export async function open(value: string) {
  const [iv, data] = value.split(".");
  return new TextDecoder().decode(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: Buffer.from(iv!, "base64") },
      await payloadKey(),
      Buffer.from(data!, "base64"),
    ),
  );
}
