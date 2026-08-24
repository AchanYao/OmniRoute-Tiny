import { CURSOR_CONFIG } from "../constants/oauth";
import { resolveCursorExpiresInSec } from "@omniroute/open-sse/services/tokenRefresh/providers/cursorExpiry.ts";

export const cursor = {
  config: CURSOR_CONFIG,
  flowType: "import_token" as const,
  mapTokens: (tokens: Record<string, unknown>) => ({
    accessToken:
      (typeof tokens.access_token === "string" ? tokens.access_token : undefined) ||
      (typeof tokens.accessToken === "string" ? tokens.accessToken : "") ||
      "",
    refreshToken: null,
    expiresIn: resolveCursorExpiresInSec({
      accessToken:
        (typeof tokens.access_token === "string" ? tokens.access_token : undefined) ||
        (typeof tokens.accessToken === "string" ? tokens.accessToken : undefined),
      expiresIn: tokens.expiresIn,
      expires_in: tokens.expires_in,
      expiresAt: tokens.expiresAt,
      expires_at: tokens.expires_at,
    }),
    providerSpecificData: {
      machineId:
        (typeof tokens.machineId === "string" ? tokens.machineId : undefined) ||
        (typeof (tokens.providerSpecificData as Record<string, unknown> | undefined)?.machineId ===
        "string"
          ? ((tokens.providerSpecificData as Record<string, unknown>).machineId as string)
          : "") ||
        "",
      authMethod: "imported",
    },
  }),
};
