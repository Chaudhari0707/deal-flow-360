import { Elysia } from "elysia";

import { meResponseModel, workspaceResponseModel } from "@/features/workspace/model";
import { workspaceSnapshot } from "@/features/workspace/query";
import { permissions } from "@/lib/domain/permissions";
import { actorContext } from "@/server/access";
import { apiErrorResponses } from "@/server/models";

export const workspaceRoutes = new Elysia({ name: "workspace", tags: ["Workspace"] })
  .use(actorContext)
  .get("/me", ({ actor }) => ({ actor }), {
    authorize: true,
    response: { 200: meResponseModel, ...apiErrorResponses },
  })
  .get(
    "/workspace",
    async ({ actor, set }) => {
      set.headers["cache-control"] = "private, no-store";
      return workspaceSnapshot(actor);
    },
    {
      authorize: permissions.workspace,
      response: { 200: workspaceResponseModel, ...apiErrorResponses },
    },
  );
