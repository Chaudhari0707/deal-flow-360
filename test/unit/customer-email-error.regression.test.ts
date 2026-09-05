import { expect, test } from "bun:test";

import { customerEmailError } from "@/features/catalog/customer-email-error";

test("welcome email guidance identifies test-sender restrictions without disclosing provider data", () => {
  const message = customerEmailError({
    name: "validation_error",
    message:
      "You can only send testing emails to your own email address (private@example.test). secret-token",
  });
  expect(message).toContain("verified sending domain");
  expect(message).toContain("Retrying the same test sender will not fix this");
  expect(message).not.toContain("private@example.test");
  expect(message).not.toContain("secret-token");
});

test("welcome email guidance distinguishes configuration, rate limits and uncertain failures", () => {
  expect(customerEmailError({ name: "missing_api_key" })).toContain("sending permissions");
  expect(customerEmailError({ name: "rate_limit_exceeded" })).toContain("Wait briefly");
  expect(customerEmailError({ name: "invalid_from_address" })).toContain("saved sender address");
  expect(
    customerEmailError({ name: "validation_error", message: "The domain is not verified" }),
  ).toContain("Verify the saved sender's domain");
  for (const error of [null, undefined, "secret-token", new Error("secret-token")]) {
    expect(customerEmailError(error)).toContain("Check email configuration and retry");
    expect(customerEmailError(error)).not.toContain("secret-token");
  }
});
