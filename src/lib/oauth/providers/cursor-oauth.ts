import { CURSOR_OAUTH_CONFIG } from "../constants/oauth";
import { generatePKCE } from "../utils/pkce";

export const cursorOauth = {
  config: CURSOR_OAUTH_CONFIG,
  flowType: "device_code" as const,

  requestDeviceCode: async (config: typeof CURSOR_OAUTH_CONFIG, codeChallengeParam?: string) => {
    const { codeVerifier, codeChallenge } = generatePKCE();
    const challenge = codeChallengeParam || codeChallenge;
    const uuid = crypto.randomUUID();

    const params = new URLSearchParams({
      challenge,
      uuid,
      mode: "login",
      redirectTarget: "cli",
    });

    const loginUrl = `${config.loginUrl}?${params.toString()}`;

    return {
      device_code: `${uuid}:${codeVerifier}`,
      user_code: "",
      verification_uri: loginUrl,
      verification_uri_complete: loginUrl,
      expires_in: 300,
      interval: 2,
    };
  },

  pollToken: async (config: typeof CURSOR_OAUTH_CONFIG, deviceCode: string) => {
    const parts = (deviceCode || "").split(":");
    const uuid = parts[0];
    const verifier = parts[1];

    if (!uuid || !verifier) {
      return {
        ok: false,
        data: { error: "invalid_request", error_description: "Invalid device code format" },
      };
    }

    const pollUrl = `${config.pollUrl}?uuid=${encodeURIComponent(uuid)}&verifier=${encodeURIComponent(verifier)}`;

    const response = await fetch(pollUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (response.status === 404) {
      return { ok: false, data: { error: "authorization_pending" } };
    }

    if (!response.ok) {
      return {
        ok: false,
        data: {
          error: "poll_failed",
          error_description: `Cursor poll failed with status ${response.status}`,
        },
      };
    }

    const data = (await response.json()) as Record<string, unknown>;
    if (data?.accessToken && typeof data.accessToken === "string") {
      return {
        ok: true,
        data: {
          access_token: data.accessToken,
          refresh_token: typeof data.refreshToken === "string" ? data.refreshToken : null,
          expires_in: 86400,
        },
      };
    }

    return { ok: false, data: { error: "authorization_pending" } };
  },

  mapTokens: (tokens: Record<string, unknown>) => ({
    accessToken:
      (typeof tokens.access_token === "string" ? tokens.access_token : undefined) ||
      (typeof tokens.accessToken === "string" ? tokens.accessToken : "") ||
      "",
    refreshToken:
      (typeof tokens.refresh_token === "string" ? tokens.refresh_token : undefined) ||
      (typeof tokens.refreshToken === "string" ? tokens.refreshToken : null) ||
      null,
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
      authMethod: "oauth",
    },
  }),
};
