import type { auditEntries } from "@/lib/db/schema/commerce";

export function approvalCycleMetrics(events: (typeof auditEntries.$inferSelect)[]) {
  const cycles = new Map<string, { completed: boolean; highRisk: boolean; start: number }>();
  const durations: number[] = [];
  for (const event of events) {
    if (event.revision === null) continue;
    const key = `${event.entityId}:${event.revision}`;
    const time = event.createdAt.getTime();
    const risk = event.detail?.risk;
    const highRisk = Boolean(
      risk && typeof risk === "object" && "risk" in risk && risk.risk === "HIGH",
    );
    if (event.action === "AUTO_APPROVED") {
      if (!cycles.has(key)) {
        cycles.set(key, { completed: true, highRisk: false, start: time });
        durations.push(0);
      }
    } else if (event.action === "QUOTE_SUBMITTED" || event.action === "CUSTOMER_COUNTERED") {
      if (cycles.has(key)) continue;
      const automatic =
        event.action === "CUSTOMER_COUNTERED" &&
        risk &&
        typeof risk === "object" &&
        "risk" in risk &&
        risk.risk === "NONE";
      cycles.set(key, { completed: Boolean(automatic), highRisk, start: time });
      if (automatic) durations.push(0);
    } else {
      const cycle = cycles.get(key);
      if (!cycle || cycle.completed || time < cycle.start) continue;
      if (event.action === "APPROVAL_RETURN" || event.action === "APPROVAL_REJECT") {
        cycle.completed = true;
        continue;
      }
      if (
        event.action === "APPROVAL_APPROVE" &&
        (!cycle.highRisk || event.detail?.step === "finance")
      ) {
        durations.push(time - cycle.start);
        cycle.completed = true;
      }
    }
  }
  return {
    averageApprovalHours: durations.length
      ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length / 3600000
      : null,
    completedApprovalCycles: durations.length,
  };
}
