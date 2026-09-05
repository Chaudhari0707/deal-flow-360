import type { Static } from "elysia";

import type { workspaceResponseModel } from "@/features/workspace/model";
import type { JsonTransport } from "@/lib/api/_types/client";

export type Serialized<Data> = JsonTransport<Data>;
export type Workspace = Omit<WorkspaceResponse, "asOf"> & { asOf?: string };
export type WorkspaceResponse = JsonTransport<Static<typeof workspaceResponseModel>>;
