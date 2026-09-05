import { runDueBilling } from "@/features/billing/service";

/** Durable work is discovered from subscription period state; retries use the same invoice keys. */
export function startBillingScheduler() {
  const state = {
    enabled: true,
    lastRunAt: null as string | null,
    lastSuccessAt: null as string | null,
    failed: false,
  };
  let running = false;
  async function tick() {
    if (running) return;
    running = true;
    state.lastRunAt = new Date().toISOString();
    try {
      await runDueBilling({
        id: "",
        name: "Automatic billing",
        email: "system@dealflow360.demo",
        role: "finance",
        customerId: null,
      });
      state.failed = false;
      state.lastSuccessAt = new Date().toISOString();
    } catch {
      state.failed = true;
      console.error(
        "Automatic billing could not complete; due periods remain available for retry.",
      );
    } finally {
      running = false;
    }
  }
  void tick();
  const timer = setInterval(() => void tick(), 60_000);
  return { state, stop: () => clearInterval(timer) };
}
