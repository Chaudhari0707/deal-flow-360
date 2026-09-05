"use client";

import useSWR from "swr";

import { apiClient, apiData } from "@/lib/api/client";
import type { WorkspaceResponse } from "@/lib/domain/_types/workspace";

export const workspaceKey = "/api/v1/workspace";

export function useWorkspace() {
  return useSWR<WorkspaceResponse>(
    workspaceKey,
    async () => apiData(await apiClient.api.v1.workspace.get()),
    {
      refreshInterval: 30_000,
    },
  );
}
