import { describe, expect, test } from "bun:test";

import { trustedOrigins } from "@/lib/auth/create-auth";

describe("trusted authentication origins", () => {
  test.each([
    ["http://localhost:3000", ["http://localhost:3000", "http://127.0.0.1:3000"]],
    ["http://127.0.0.1:3001", ["http://127.0.0.1:3001", "http://localhost:3001"]],
    ["https://localhost:4443", ["https://localhost:4443", "https://127.0.0.1:4443"]],
    ["http://LOCALHOST:80/login?next=dashboard#form", ["http://localhost", "http://127.0.0.1"]],
    ["https://127.0.0.1:443/", ["https://127.0.0.1", "https://localhost"]],
    ["https://APP.EXAMPLE.COM:443/login", ["https://app.example.com"]],
    ["http://localhost.example.com:3000", ["http://localhost.example.com:3000"]],
    ["http://127.0.0.2:3000", ["http://127.0.0.2:3000"]],
  ])("normalizes %s without broadening its scheme or port", (input, expected) => {
    expect(trustedOrigins(input as string)).toEqual(expected);
  });

  test("malformed configuration is rejected rather than trusted", () => {
    expect(() => trustedOrigins("not a valid URL")).toThrow();
  });
});
