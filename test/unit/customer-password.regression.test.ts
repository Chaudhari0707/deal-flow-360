import { afterEach, expect, test } from "bun:test";

import {
  CUSTOMER_PASSWORD_LENGTH,
  customerPassword,
  randomCustomerPassword,
} from "@/features/catalog/customer-password";

const original = Bun.env.CUSTOMER_TEMP_PASSWORD;

afterEach(() => {
  if (original === undefined) delete Bun.env.CUSTOMER_TEMP_PASSWORD;
  else Bun.env.CUSTOMER_TEMP_PASSWORD = original;
});

test("provisioning issues a readable eight-character credential by default", () => {
  delete Bun.env.CUSTOMER_TEMP_PASSWORD;
  const password = customerPassword();
  expect(password).toBe("test1234");
  expect(password).toHaveLength(CUSTOMER_PASSWORD_LENGTH);
});

test("a configured shared password is emailed verbatim", () => {
  Bun.env.CUSTOMER_TEMP_PASSWORD = "welcome2026";
  expect(customerPassword()).toBe("welcome2026");
});

test("a shared password below the credential minimum falls back to a random one", () => {
  Bun.env.CUSTOMER_TEMP_PASSWORD = "short";
  const password = customerPassword();
  expect(password).not.toBe("short");
  expect(password).toHaveLength(CUSTOMER_PASSWORD_LENGTH);
});

test("random credentials avoid glyphs a customer could mistype from the welcome email", () => {
  const passwords = Array.from({ length: 200 }, () => randomCustomerPassword());
  for (const password of passwords) expect(password).toMatch(/^[a-km-np-z2-9]{8}$/);
  expect(new Set(passwords).size).toBeGreaterThan(1);
});
