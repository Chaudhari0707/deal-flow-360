"use client";

import useSWR from "swr";

import type { Workspace } from "@/lib/domain/_types/workspace";

export const workspaceKey = "/api/v1/workspace";

export function useWorkspace() {
  return useSWR<Workspace>(workspaceKey);
}
