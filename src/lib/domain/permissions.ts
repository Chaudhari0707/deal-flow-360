import type { Role } from "@/lib/domain/_types/domain";
import type { Permission } from "@/lib/domain/_types/permissions";

// Shared by server authorization and navigation. Ownership and workflow-step checks
// remain in the service that owns the resource.
export const permissions = {
  workspace: ["rep", "manager", "finance", "ops", "admin"],
  quotations: ["rep", "manager", "finance", "ops", "admin"],
  quoteWrite: ["rep"],
  quoteSend: ["rep", "manager", "finance"],
  approvals: ["manager", "finance"],
  customers: ["rep", "manager", "admin"],
  customerEdit: ["manager", "admin"],
  fulfillment: ["rep", "manager", "ops"],
  stockRead: ["rep", "manager", "ops", "admin"],
  stockSetup: ["admin"],
  fulfillmentOperate: ["ops"],
  invoices: ["rep", "manager", "finance"],
  subscriptions: ["rep", "manager", "finance"],
  billingRead: ["rep", "manager", "finance", "admin"],
  billingWrite: ["finance"],
  health: ["manager"],
  reports: ["manager", "finance", "admin"],
  catalog: ["admin"],
  settings: ["manager", "admin"],
} satisfies Record<string, Role[]>;

export function can(role: Role, permission: Permission) {
  return (permissions[permission] as Role[]).includes(role);
}
