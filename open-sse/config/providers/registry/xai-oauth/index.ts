import type { RegistryEntry } from "../../shared.ts";
import { resolvePublicCred } from "../../shared.ts";
import { xaiProvider } from "../xai/index.ts";

const XAI_MODELS_URL = "https://api.x.ai/v1/models";

export const xai_oauthProvider: RegistryEntry = {
  id: "xai-oauth",
  alias: "xao",
  format: "openai",
  executor: "xai-oauth",
  baseUrl: xaiProvider.baseUrl,
  responsesBaseUrl: xaiProvider.responsesBaseUrl,
  authType: "oauth",
  authHeader: "bearer",
  modelsUrl: XAI_MODELS_URL,
  passthroughModels: true,
  oauth: {
    clientIdEnv: "GROK_OAUTH_CLIENT_ID",
    clientIdDefault: resolvePublicCred("grok_id", "GROK_OAUTH_CLIENT_ID"),
    tokenUrl: "https://auth.x.ai/oauth2/token",
  },
  models: [],
};
