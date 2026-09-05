import type { Role } from "@/lib/domain/_types/domain";

export const defaultApprovalChain: readonly Role[] = ["manager", "finance"];
const approvalRoles: readonly Role[] = ["manager", "finance"];

export function approvalChain(value?: Record<string, number>): Role[] {
  const configured = Object.entries(value ?? {})
    .filter(
      ([role, rank]) => approvalRoles.includes(role as Role) && Number.isInteger(rank) && rank > 0,
    )
    .sort(([, a], [, b]) => a - b)
    .map(([role]) => role as Role);
  return configured.length ? configured : [...defaultApprovalChain];
}

export function requiredApprovalChain(risk: string, value?: Record<string, number>) {
  const chain = approvalChain(value);
  return risk === "HIGH" ? chain : chain.slice(0, 1);
}
