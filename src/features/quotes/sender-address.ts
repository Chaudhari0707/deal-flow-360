const BARE_EMAIL = /^[^\s<>]+@[^\s<>]+$/;
const ANGLE_ADDRESS = /^[^<>]*<[^\s<>]+@[^\s<>]+>$/;

/**
 * Normalize a display-name + address pair into the RFC 5322 form Resend
 * accepts: `Name <email@example.com>` or a bare email.
 *
 * A common local-env mistake is `DealFlow360 onboarding@resend.dev` (missing
 * angle brackets). That produces HTTP 200 + FAILED from send, which used to
 * look like a successful board move that then snapped back.
 */
export function senderAddress(value: string): string {
  const trimmed = value.trim().replace(/^["']|["']$/g, "");
  if (ANGLE_ADDRESS.test(trimmed) || BARE_EMAIL.test(trimmed)) return trimmed;
  const parts = trimmed.match(/^(.+?)\s+([^\s<>]+@[^\s<>]+)$/);
  if (parts) return `${parts[1]} <${parts[2]}>`;
  return trimmed;
}
