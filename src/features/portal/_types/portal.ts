import type { Static } from "elysia";

import type {
  portalDetailModel,
  portalWorkspaceModel,
  publicQuoteModel,
} from "@/features/quotes/model";
import type { JsonTransport } from "@/lib/api/_types/client";

export type PortalDetail = JsonTransport<Static<typeof portalDetailModel>>;
export type PortalWorkspace = JsonTransport<Static<typeof portalWorkspaceModel>>;
export type PublicQuote = JsonTransport<Static<typeof publicQuoteModel>>;
