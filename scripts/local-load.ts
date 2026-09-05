interface RequestSample {
  elapsedMs: number;
  endpoint: string;
  status: number;
}

const endpoints = [
  "/api/v1/workspace",
  "/api/v1/inventory?pageSize=20",
  "/api/v1/fulfillment/orders?pageSize=20",
];

function options() {
  const settings = {
    baseURL: "http://127.0.0.1:3000",
    burstSeconds: 10,
    concurrency: 10,
    sustainedSeconds: 60,
  };
  const args = Bun.argv.slice(2);
  if (args.includes("--help")) return null;
  for (let index = 0; index < args.length; index += 2) {
    const value = args[index + 1];
    if (!value) throw new Error(`Missing value for ${args[index]}`);
    switch (args[index]) {
      case "--base-url":
        settings.baseURL = value;
        break;
      case "--sustained-seconds":
        settings.sustainedSeconds = Number(value);
        break;
      case "--burst-seconds":
        settings.burstSeconds = Number(value);
        break;
      case "--concurrency":
        settings.concurrency = Number(value);
        break;
      default:
        throw new Error(`Unknown option ${args[index]}`);
    }
  }
  const base = new URL(settings.baseURL);
  if (
    base.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(base.hostname) ||
    base.pathname !== "/" ||
    base.search ||
    base.hash ||
    base.username ||
    base.password
  )
    throw new Error("Load measurements require a local HTTP origin without credentials or a path");
  for (const [name, value, maximum] of [
    ["sustained seconds", settings.sustainedSeconds, 120],
    ["burst seconds", settings.burstSeconds, 30],
    ["concurrency", settings.concurrency, 20],
  ] as const) {
    if (!Number.isInteger(value) || value < 1 || value > maximum)
      throw new Error(`${name} must be an integer from 1 to ${maximum}`);
  }
  return { ...settings, baseURL: base.origin };
}

function latency(samples: RequestSample[]) {
  const sorted = samples.map((sample) => sample.elapsedMs).sort((a, b) => a - b);
  const percentile = (fraction: number) =>
    sorted.length
      ? Math.round((sorted[Math.ceil(sorted.length * fraction) - 1] ?? 0) * 100) / 100
      : null;
  return {
    p50: percentile(0.5),
    p95: percentile(0.95),
    max: sorted.length ? Math.round(sorted.at(-1)! * 100) / 100 : null,
  };
}

async function main() {
  const settings = options();
  if (!settings) {
    console.log(
      "Usage: bun scripts/local-load.ts [--base-url http://127.0.0.1:3000] [--sustained-seconds 60] [--burst-seconds 10] [--concurrency 10]",
    );
    console.log(
      "Uses LOAD_TEST_EMAIL (default admin demo) and LOAD_TEST_PASSWORD or DEMO_PASSWORD from ignored environment. Read-only phases: 5 RPS, then 20 RPS. Report: .local/local-load-report.json",
    );
    return;
  }
  const password = Bun.env.LOAD_TEST_PASSWORD ?? Bun.env.DEMO_PASSWORD;
  if (!password)
    throw new Error("Set LOAD_TEST_PASSWORD or DEMO_PASSWORD in the ignored local environment");
  const login = await fetch(`${settings.baseURL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: settings.baseURL },
    body: JSON.stringify({ email: Bun.env.LOAD_TEST_EMAIL ?? "admin@dealflow360.demo", password }),
    signal: AbortSignal.timeout(10000),
  });
  if (!login.ok) throw new Error(`Load measurement authentication failed (${login.status})`);
  const cookie = login.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  if (!cookie) throw new Error("Authentication returned no session cookie");
  await login.arrayBuffer();
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.on("SIGINT", cancel);
  process.on("SIGTERM", cancel);
  let cleanupSucceeded = false;
  const startedAt = new Date().toISOString();
  const phases = [];
  async function read(endpoint: string) {
    const started = performance.now();
    let status = 0;
    try {
      const response = await fetch(`${settings!.baseURL}${endpoint}`, {
        headers: { cookie },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
      });
      await response.arrayBuffer();
      status = response.status;
    } catch {
      /* Status zero records transport failure/timeout without logging response bodies. */
    }
    return { elapsedMs: performance.now() - started, endpoint, status };
  }
  async function phase(name: string, rps: number, seconds: number) {
    console.log(
      `Measuring ${name}: ${rps} requests/second for ${seconds} seconds; at most ${settings!.concurrency} in flight.`,
    );
    const samples: RequestSample[] = [];
    const pending = new Set<Promise<void>>();
    const started = performance.now();
    const scheduled = rps * seconds;
    let skipped = 0;
    async function until(target: number) {
      const remaining = target - performance.now();
      if (remaining > 0 && !controller.signal.aborted)
        await new Promise((resolve) => setTimeout(resolve, remaining));
    }
    for (let index = 0; index < scheduled && !controller.signal.aborted; index++) {
      await until(started + (index * 1000) / rps);
      if (controller.signal.aborted) break;
      if (
        pending.size >= settings!.concurrency ||
        performance.now() - (started + (index * 1000) / rps) >= 1000 / rps
      ) {
        skipped++;
        continue;
      }
      const task = read(endpoints[index % endpoints.length]!)
        .then((sample) => {
          samples.push(sample);
        })
        .finally(() => pending.delete(task));
      pending.add(task);
    }
    await until(started + seconds * 1000);
    await Promise.all(pending);
    const elapsedSeconds = (performance.now() - started) / 1000;
    const successful = samples.filter((sample) => sample.status >= 200 && sample.status < 300);
    const statuses: Record<string, number> = {};
    for (const sample of samples)
      statuses[String(sample.status)] = (statuses[String(sample.status)] ?? 0) + 1;
    return {
      name,
      requestedRps: rps,
      plannedSeconds: seconds,
      elapsedSeconds: Math.round(elapsedSeconds * 100) / 100,
      scheduledRequests: scheduled,
      attemptedRequests: samples.length,
      skippedRequests: skipped,
      successfulRequests: successful.length,
      failedRequests: samples.length - successful.length,
      errorRate: samples.length ? (samples.length - successful.length) / samples.length : null,
      achievedRps: Math.round((samples.length / elapsedSeconds) * 100) / 100,
      latencyMs: latency(samples),
      successfulLatencyMs: latency(successful),
      statuses,
    };
  }
  try {
    for (const endpoint of endpoints) {
      const sample = await read(endpoint);
      if (sample.status !== 200)
        throw new Error(`Authenticated warmup failed (${sample.status}) at ${endpoint}`);
    }
    phases.push(await phase("sustained read smoke", 5, settings.sustainedSeconds));
    if (!controller.signal.aborted)
      phases.push(await phase("read burst", 20, settings.burstSeconds));
  } finally {
    try {
      cleanupSucceeded = (
        await fetch(`${settings.baseURL}/api/auth/sign-out`, {
          method: "POST",
          headers: { cookie, origin: settings.baseURL, "content-type": "application/json" },
          body: "{}",
          signal: AbortSignal.timeout(3000),
        })
      ).ok;
    } catch {
      /* The local report records whether the measurement session was closed. */
    }
    process.removeListener("SIGINT", cancel);
    process.removeListener("SIGTERM", cancel);
    const report = {
      measuredAt: startedAt,
      completedAt: new Date().toISOString(),
      baseURL: settings.baseURL,
      runtime: { bun: Bun.version, os: process.platform, architecture: process.arch },
      concurrencyLimit: settings.concurrency,
      requestTimeoutMs: 10000,
      warmupRequests: endpoints.length,
      workload:
        "One authenticated session; read-only bounded workspace, inventory and fulfillment endpoints. No write, multi-user or production capacity claim.",
      aborted: controller.signal.aborted,
      completed: phases.length === 2 && !controller.signal.aborted,
      sessionCleanupSucceeded: cleanupSucceeded,
      phases,
    };
    await Bun.write(
      new URL("../.local/local-load-report.json", import.meta.url),
      `${JSON.stringify(report, null, 2)}\n`,
      { createPath: true },
    );
    console.log(
      JSON.stringify({ phases, report: ".local/local-load-report.json", aborted: report.aborted }),
    );
    if (
      report.aborted ||
      phases.some((result) => result.failedRequests > 0 || result.skippedRequests > 0)
    )
      process.exitCode = 1;
  }
}

await main();
