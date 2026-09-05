const SYSTEM_DATABASES = new Set(["postgres", "template0", "template1"]);

export function describeDatabaseUrl(value: string) {
  const url = new URL(value);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));

  return {
    database,
    host: url.hostname,
    port: url.port || "5432",
  };
}

export function assertDisposableDatabase(value: string, target: "development" | "test") {
  const descriptor = describeDatabaseUrl(value);
  const localHosts = new Set(["127.0.0.1", "::1", "localhost"]);

  if (!descriptor.database || SYSTEM_DATABASES.has(descriptor.database)) {
    throw new Error(
      `Refusing to operate on reserved database '${descriptor.database || "unknown"}'`,
    );
  }

  if (target === "test" && !descriptor.database.endsWith("_test")) {
    throw new Error("Test database name must end in _test");
  }

  if (target === "development") {
    if (!localHosts.has(descriptor.host)) throw new Error("Development reset/push is local-only");
    if (!descriptor.database.endsWith("_dev")) {
      throw new Error("Development database name must end in _dev");
    }
  }

  return descriptor;
}

export function requireDatabaseUrl(name: "DATABASE_URL" | "TEST_DATABASE_URL") {
  const value = Bun.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
