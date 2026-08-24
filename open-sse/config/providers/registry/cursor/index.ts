import type { ModelEntry, RegistryEntry } from "../../shared.ts";
import { CURSOR_REGISTRY_VERSION, getCursorRegistryHeaders } from "../../shared.ts";

const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;

function buildClaudeFamilyModels(family: string, displayName: string): ModelEntry[] {
  const entries: ModelEntry[] = [{ id: family, name: displayName }];
  for (const effort of EFFORTS) {
    entries.push({ id: `${family}-${effort}`, name: `${displayName} ${effort}` });
    entries.push({ id: `${family}-${effort}-fast`, name: `${displayName} ${effort} Fast` });
    entries.push({ id: `${family}-thinking-${effort}`, name: `${displayName} Thinking ${effort}` });
    entries.push({
      id: `${family}-thinking-${effort}-fast`,
      name: `${displayName} Thinking ${effort} Fast`,
    });
  }
  return entries;
}

export const CURSOR_STATIC_MODELS: ModelEntry[] = [
  { id: "auto", name: "Auto (Server Picks)" },
  { id: "composer-2.5", name: "Composer 2.5" },
  { id: "composer-2.5-fast", name: "Composer 2.5 Fast" },
  ...buildClaudeFamilyModels("claude-opus-4-8", "Claude Opus 4.8"),
  ...buildClaudeFamilyModels("claude-fable-5", "Claude Fable 5"),
  ...buildClaudeFamilyModels("claude-sonnet-5", "Claude Sonnet 5"),
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
  { id: "claude-opus-4-7", name: "Claude Opus 4.7" },
  { id: "gpt-5.6-luna", name: "GPT 5.6 Luna" },
  { id: "gpt-5.6-sol", name: "GPT 5.6 Sol" },
  { id: "gpt-5.5", name: "GPT 5.5" },
  { id: "gpt-5.4", name: "GPT 5.4" },
  { id: "kimi-k3", name: "Kimi K3" },
  { id: "kimi-k3-low", name: "Kimi K3 Low" },
  { id: "kimi-k3-high", name: "Kimi K3 High" },
  { id: "kimi-k3-max", name: "Kimi K3 Max" },
  { id: "cursor-grok-4.6", name: "Cursor Grok 4.6" },
  { id: "cursor-grok-4.5", name: "Cursor Grok 4.5" },
  { id: "gemini-3.7-flash", name: "Gemini 3.7 Flash" },
];

export const cursorProvider: RegistryEntry = {
  id: "cursor",
  alias: "cu",
  format: "cursor",
  executor: "cursor",
  baseUrl: "https://api2.cursor.sh",
  chatPath: "/aiserver.v1.ChatService/StreamUnifiedChatWithTools",
  authType: "oauth",
  authHeader: "bearer",
  defaultContextLength: 200000,
  headers: getCursorRegistryHeaders(),
  clientVersion: CURSOR_REGISTRY_VERSION,
  passthroughModels: true,
  models: CURSOR_STATIC_MODELS,
};

export const cursorOAuthProvider: RegistryEntry = {
  ...cursorProvider,
  id: "cursor-oauth",
  alias: "cuo",
};
