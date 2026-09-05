import type { Role } from "@/lib/domain/_types/domain";

type ApprovalRole = Extract<Role, "manager" | "finance">;

export const defaultApprovalChain: readonly ApprovalRole[] = ["manager", "finance"];
const approvalRoles: readonly ApprovalRole[] = ["manager", "finance"];

export function approvalChain(value?: Record<string, number>): ApprovalRole[] {
  const configured = Object.entries(value ?? {})
    .filter(
      ([role, rank]) =>
        approvalRoles.includes(role as ApprovalRole) && Number.isInteger(rank) && rank > 0,
    )
    .sort(([, a], [, b]) => a - b)
    .map(([role]) => role as ApprovalRole);
  return configured.length ? configured : [...defaultApprovalChain];
}

export function requiredApprovalChain(risk: string, value?: Record<string, number>) {
  const chain = approvalChain(value);
  return risk === "HIGH" ? chain : chain.slice(0, 1);
}
