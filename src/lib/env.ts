type RuntimeGlobals = typeof globalThis & {
  Bun?: { env: Record<string, string | undefined> };
  process?: { env: Record<string, string | undefined> };
};

const runtimeGlobals = globalThis as RuntimeGlobals;

export const env = runtimeGlobals.Bun?.env ?? runtimeGlobals.process?.env ?? {};
