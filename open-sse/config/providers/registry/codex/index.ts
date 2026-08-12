import type { RegistryEntry } from "../../shared.ts";
import { appendEffortVariants, isEffortVariantsEnabled } from "../../../effortVariants.ts";
import {
  GPT_5_6_CODEX_CAPABILITIES,
  GPT_5_5_CODEX_CAPABILITIES,
  getCodexDefaultHeaders,
  resolvePublicCred,
} from "../../shared.ts";

const CODEX_BASE_MODELS: NonNullable<RegistryEntry["models"]> = [
  {
    id: "gpt-5.6-sol",
    name: "GPT 5.6 Sol",
    ...GPT_5_6_CODEX_CAPABILITIES,
    supportedThinkingEfforts: ["low", "medium", "high", "xhigh", "max", "ultra"],
  },
  {
    id: "gpt-5.6-terra",
    name: "GPT 5.6 Terra",
    ...GPT_5_6_CODEX_CAPABILITIES,
    supportedThinkingEfforts: ["low", "medium", "high", "xhigh", "max", "ultra"],
  },
  {
    id: "gpt-5.6-luna",
    name: "GPT 5.6 Luna",
    ...GPT_5_6_CODEX_CAPABILITIES,
    supportedThinkingEfforts: ["low", "medium", "high", "xhigh", "max"],
  },
  // gpt-5.5 codex OAuth backend caps context at 400K (not the public-API
  // 1.05M). Public refs : openai/codex#19208, #19319, #19464 ;
  // opencode#24171. max_output_tokens is stripped server-side
  // (litellm#21193, codex#4138) so 128K is informational only.
  // The usable INPUT budget is smaller than the 400K window (part is
  // reserved for output), so max_input_tokens must be distinct from
  // context_length or coding agents never auto-compact (#6191). OpenAI's
  // own live catalog reports ~272K for gpt-5.5 in Codex.
  {
    id: "gpt-5.5",
    name: "GPT 5.5",
    ...GPT_5_5_CODEX_CAPABILITIES,
    contextLength: 400000,
    // #6191: input cap per reporter; TODO confirm exact value
    maxInputTokens: 272000,
    maxOutputTokens: 128000,
    supportedThinkingEfforts: ["low", "medium", "high", "xhigh"],
  },
  { id: "gpt-5.3-codex-spark", name: "GPT 5.3 Codex Spark" },
];

export function getCodexRegistryModels(
  includeEffortVariants = isEffortVariantsEnabled()
): NonNullable<RegistryEntry["models"]> {
  return includeEffortVariants ? appendEffortVariants(CODEX_BASE_MODELS) : [...CODEX_BASE_MODELS];
}

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
  models: getCodexRegistryModels(),
};
