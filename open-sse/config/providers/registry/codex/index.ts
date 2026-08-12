import type { RegistryEntry } from "../../shared.ts";
import { getCodexDefaultHeaders, resolvePublicCred } from "../../shared.ts";

export const codexProvider: RegistryEntry = {
  id: "codex",
  format: "openai-responses",
  executor: "codex",
  baseUrl: "https://chatgpt.com/backend-api/codex/responses",
  authType: "oauth",
  authHeader: "bearer",
  defaultContextLength: 400000,
  headers: getCodexDefaultHeaders(),
  oauth: {
    clientIdEnv: "CODEX_OAUTH_CLIENT_ID",
    clientIdDefault: resolvePublicCred("codex_id"),
    clientSecretEnv: "CODEX_OAUTH_CLIENT_SECRET",
    clientSecretDefault: "",
    tokenUrl: "https://auth.openai.com/oauth/token",
  },
  // Model inventory is account-scoped and comes exclusively from upstream discovery.
  models: [],
};
