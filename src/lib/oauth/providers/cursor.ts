import { CURSOR_CONFIG } from "../constants/oauth";

export const cursor = {
  config: CURSOR_CONFIG,
  flowType: "import_token" as const,
  mapTokens: (tokens: Record<string, unknown>) => ({
    accessToken:
      (typeof tokens.access_token === "string" ? tokens.access_token : undefined) ||
      (typeof tokens.accessToken === "string" ? tokens.accessToken : "") ||
      "",
    refreshToken: null,
    expiresIn:
      (typeof tokens.expires_in === "number" ? tokens.expires_in : undefined) ||
      (typeof tokens.expiresIn === "number" ? tokens.expiresIn : undefined) ||
      86400,
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
