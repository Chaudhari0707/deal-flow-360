// "l", "o", "0" and "1" are excluded so a customer can retype the password from the welcome
// email without guessing which glyph was sent. The remaining 32 characters divide 256 evenly,
// so byte-modulo selection stays unbiased.
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
const DEMO_PASSWORD = "test1234";

export const CUSTOMER_PASSWORD_LENGTH = 8;

export function randomCustomerPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(CUSTOMER_PASSWORD_LENGTH));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]!).join("");
}

/**
 * Provisioned customers currently share one readable demo credential so a presenter can sign
 * in as any newly created customer. `CUSTOMER_TEMP_PASSWORD` overrides it; a value shorter
 * than the Better Auth minimum would reject every provisioning call, so that falls back to a
 * random password instead of failing customer creation.
 */
export function customerPassword() {
  const configured = Bun.env.CUSTOMER_TEMP_PASSWORD ?? DEMO_PASSWORD;
  return configured.length >= CUSTOMER_PASSWORD_LENGTH ? configured : randomCustomerPassword();
}
