import postgres from "postgres";

import { runCommand } from "./_lib/run-command";

const root = import.meta.dir.replace(/[\\/]scripts$/, "");
const args = Bun.argv.slice(2);
if (args.some((arg) => arg !== "--check"))
  throw new Error("Usage: bun run scripts/dev-local.ts [--check]");
await runCommand(["bun", "run", "env:check"], { cwd: root });

const origin = new URL(Bun.env.BETTER_AUTH_URL!);
if (
  origin.protocol !== "http:" ||
  origin.hostname !== "127.0.0.1" ||
  origin.pathname !== "/" ||
  origin.search ||
  origin.hash
) {
  throw new Error("Local startup requires BETTER_AUTH_URL=http://127.0.0.1:<port> without a path");
}
const webPort = Number(origin.port || 80);
const stockPort = Number(Bun.env.REALTIME_PORT ?? webPort + 101);
if (
  !Number.isInteger(webPort) ||
  webPort < 1024 ||
  webPort > 65434 ||
  stockPort !== webPort + 101
) {
  throw new Error("Use an app port from 1024 to 65434 and REALTIME_PORT exactly 101 higher");
}
const env = Object.fromEntries(
  Object.entries(Bun.env).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  ),
);
env.REALTIME_PORT = String(stockPort);
env.AUTOMATIC_BILLING = Bun.env.AUTOMATIC_BILLING ?? "true";
const database = postgres(Bun.env.DATABASE_URL!, {
  connect_timeout: 5,
  max: 1,
  onnotice: () => {},
});
try {
  const [schema] = await database<
    { ready: boolean }[]
  >`select to_regclass('public.orders') is not null as ready`;
  if (!schema?.ready) throw new Error("Migrations have not been applied");
} catch {
  throw new Error(
    "The configured PostgreSQL database is unavailable or unmigrated. Start that database, then run bun run dev:setup.",
  );
} finally {
  await database.end();
}
console.log(`Local configuration ready: app ${origin.origin}, stock port ${stockPort}`);

if (!args.includes("--check")) {
  // Refuse occupied ports; never terminate an unrelated listener or silently choose another port.
  for (const port of [webPort, stockPort]) {
    let occupied = false;
    try {
      const listener = await Bun.connect({ hostname: "127.0.0.1", port, socket: { data() {} } });
      listener.end();
      occupied = true;
    } catch {
      /* Connection refusal is expected when no service is listening. */
    }
    if (occupied)
      throw new Error(
        `Port ${port} is already in use. Stop its owning app before starting this local workspace.`,
      );
    try {
      const probe = Bun.listen({ hostname: "127.0.0.1", port, socket: { data() {} } });
      probe.stop(true);
    } catch {
      throw new Error(
        `Port ${port} is already in use. Stop its owning app before starting this local workspace.`,
      );
    }
  }

  const controller = new AbortController();
  const children: { name: string; process: ReturnType<typeof Bun.spawn> }[] = [];
  let requestedStop = false;
  const stop = () => {
    requestedStop = true;
    controller.abort();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
    for (const [name, command] of [
      [
        "Next.js",
        ["bun", "--bun", "next", "dev", "--hostname", "127.0.0.1", "--port", String(webPort)],
      ],
      ["Stock feed", ["bun", "run", "scripts/realtime.ts"]],
    ] as const) {
      children.push({
        name,
        process: Bun.spawn([...command], {
          cwd: root,
          env,
          signal: controller.signal,
          killSignal: "SIGTERM",
          stdin: "ignore",
          stdout: "inherit",
          stderr: "inherit",
        }),
      });
    }
    console.log("Starting the local workspace. Ctrl+C stops both application processes.");
    const firstExit = await Promise.race(
      children.map(async (child) => ({ name: child.name, code: await child.process.exited })),
    );
    if (!requestedStop) {
      console.error(
        `${firstExit.name} stopped unexpectedly (exit ${firstExit.code}); stopping the other application process.`,
      );
      process.exitCode = firstExit.code || 1;
    }
  } finally {
    controller.abort();
    const deadline = setTimeout(() => {
      for (const child of children)
        if (child.process.exitCode === null) child.process.kill("SIGKILL");
    }, 5000);
    await Promise.all(children.map((child) => child.process.exited));
    clearTimeout(deadline);
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  }
}
