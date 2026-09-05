import { describe, expect, test } from "bun:test";

import { assertDisposableDatabase, describeDatabaseUrl } from "../../scripts/_lib/database-url";

describe("database command guard", () => {
  test("reports a target without exposing credentials", () => {
    const target = describeDatabaseUrl(
      "postgresql://private-user:private-password@127.0.0.1:5433/deal_flow_360_dev?sslmode=disable",
    );

    expect(target).toEqual({
      database: "deal_flow_360_dev",
      host: "127.0.0.1",
      port: "5433",
    });
    expect(JSON.stringify(target)).not.toContain("private-password");
  });

  test("accepts only a local development database with the dev suffix", () => {
    expect(() =>
      assertDisposableDatabase(
        "postgresql://postgres:postgres@localhost:5432/deal_flow_360_dev",
        "development",
      ),
    ).not.toThrow();
    expect(() =>
      assertDisposableDatabase(
        "postgresql://postgres:postgres@example.com:5432/deal_flow_360_dev",
        "development",
      ),
    ).toThrow("local-only");
    expect(() =>
      assertDisposableDatabase(
        "postgresql://postgres:postgres@localhost:5432/deal_flow_360",
        "development",
      ),
    ).toThrow("must end in _dev");
  });

  test("rejects system databases and requires the test suffix", () => {
    expect(() =>
      assertDisposableDatabase("postgresql://postgres:postgres@localhost:5432/postgres", "test"),
    ).toThrow("reserved database");
    expect(() =>
      assertDisposableDatabase(
        "postgresql://postgres:postgres@localhost:5432/deal_flow_360_dev",
        "test",
      ),
    ).toThrow("must end in _test");
  });
});
