import { eq, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import type { ReportFilters } from "@/features/billing/_types/reports";
import { customers, quotes } from "@/lib/db/schema/commerce";

/** Shared relationship predicates keep financial and sales exports aligned before row caps. */
export function reportRelationshipConditions(filters: ReportFilters) {
  const approval = filters.approvalStatus;
  return [
    ...(filters.repId ? [eq(quotes.ownerId, filters.repId)] : []),
    ...(filters.team ? [eq(customers.team, filters.team)] : []),
    ...(approval === "APPROVED" ? [sql`${quotes.approvedRevision} = ${quotes.revision}`] : []),
    ...(approval === "PENDING" ? [eq(quotes.status, "PENDING_APPROVAL")] : []),
    ...(approval === "NOT_SUBMITTED" ? [eq(quotes.status, "DRAFT")] : []),
    ...(approval === "RETURNED" || approval === "REJECTED" ? [eq(quotes.status, approval)] : []),
  ];
}

export function reportLineConditions(lines: AnyPgColumn, filters: ReportFilters) {
  // One JSON containment object makes category + product apply to the same line.
  const match = {
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.productId ? { productId: filters.productId } : {}),
  };
  return Object.keys(match).length ? [sql`${lines} @> ${JSON.stringify([match])}::jsonb`] : [];
}
