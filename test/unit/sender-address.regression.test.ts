import { expect, test } from "bun:test";

import { senderAddress } from "@/features/quotes/sender-address";

test("sender addresses accept Resend's required Name <email> or bare email forms", () => {
  expect(senderAddress("DealFlow360 <onboarding@resend.dev>")).toBe(
    "DealFlow360 <onboarding@resend.dev>",
  );
  expect(senderAddress("onboarding@resend.dev")).toBe("onboarding@resend.dev");
  expect(senderAddress('"DealFlow360 onboarding@resend.dev"')).toBe(
    "DealFlow360 <onboarding@resend.dev>",
  );
  expect(senderAddress("DealFlow360 onboarding@resend.dev")).toBe(
    "DealFlow360 <onboarding@resend.dev>",
  );
});
