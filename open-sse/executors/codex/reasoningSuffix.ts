export const CODEX_EFFORT_ORDER = [
  "none",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "ultra",
] as const;
export type CodexEffortLevel = (typeof CODEX_EFFORT_ORDER)[number];
const GPT_5_6_MAX_ALIAS_MODELS: Record<string, true> = {
  "gpt-5.6-sol": true,
  "gpt-5.6-terra": true,
  "gpt-5.6-luna": true,
};
const GPT_5_6_ULTRA_ALIAS_MODELS: Record<string, true> = {
  "gpt-5.6-sol": true,
  "gpt-5.6-terra": true,
};

/** Identify a retired OmniRoute Codex effort alias for migration errors only. */
export function resolveRetiredCodexEffortModelId(model: unknown): {
  baseModel: string;
  effort: CodexEffortLevel | null;
} {
  const modelId = typeof model === "string" ? model : "";
  const gpt56Match = /^(gpt-5\.6-(?:sol|terra|luna))(?:-(max|ultra)|\((max|ultra)\))$/.exec(
    modelId
  );
  if (gpt56Match) {
    const [, baseModel, hyphenEffort, parenthesizedEffort] = gpt56Match;
    const effort = hyphenEffort ?? parenthesizedEffort;
    const supportedModels = parenthesizedEffort
      ? GPT_5_6_MAX_ALIAS_MODELS
      : effort === "ultra"
        ? GPT_5_6_ULTRA_ALIAS_MODELS
        : GPT_5_6_MAX_ALIAS_MODELS;
    if (supportedModels[baseModel]) {
      return { baseModel, effort: effort as CodexEffortLevel };
    }
  }

  for (const effort of ["none", "low", "medium", "high", "xhigh"] as const) {
    if (modelId.endsWith(`-${effort}`)) {
      return { baseModel: modelId.slice(0, -`-${effort}`.length), effort };
    }
  }
  return { baseModel: modelId, effort: null };
}
