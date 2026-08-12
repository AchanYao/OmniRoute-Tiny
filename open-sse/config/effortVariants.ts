const ENABLED_VALUES = new Set(["true", "1", "yes"]);
const RESERVED_EFFORT_SUFFIXES = new Set([
  "none",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "ultra",
]);

interface EffortModelEntry {
  id?: string;
  root?: string;
  name?: string;
  owned_by?: string;
  supportedThinkingEfforts?: readonly string[];
  capabilities?: { effort_tiers?: readonly string[] };
}

export function isEffortVariantsEnabled(
  value: string | undefined = process.env.MODEL_EFFORT_VARIANTS_ENABLED
): boolean {
  return ENABLED_VALUES.has((value || "").trim().toLowerCase());
}

function getDeclaredEfforts(model: EffortModelEntry): string[] {
  const raw = Array.isArray(model.supportedThinkingEfforts)
    ? model.supportedThinkingEfforts
    : model.capabilities?.effort_tiers;
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw
        .filter((effort): effort is string => typeof effort === "string")
        .map((effort) => effort.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
}

function alreadyHasEffortSuffix(modelId: string): boolean {
  const suffix = modelId.slice(modelId.lastIndexOf("-") + 1).toLowerCase();
  return RESERVED_EFFORT_SUFFIXES.has(suffix);
}

function formatEffortLabel(effort: string): string {
  if (effort === "xhigh") return "XHigh";
  return effort.charAt(0).toUpperCase() + effort.slice(1);
}

/**
 * Add legacy `<base>-<effort>` aliases from each base model's declared effort metadata.
 * `none` remains a request capability only and is never published as a model id.
 */
export function appendEffortVariants<T extends EffortModelEntry>(models: T[]): T[] {
  if (!Array.isArray(models)) return models;

  const existingIds = new Set(
    models
      .map((model) => model.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  );
  const variants: T[] = [];

  for (const model of models) {
    if (typeof model.id !== "string" || !model.id) continue;
    if (model.owned_by === "combo" || model.id.startsWith("no-think/")) continue;
    if (alreadyHasEffortSuffix(model.id)) continue;

    const baseRoot = typeof model.root === "string" && model.root ? model.root : model.id;
    for (const effort of getDeclaredEfforts(model)) {
      if (effort === "none") continue;
      const variantId = `${model.id}-${effort}`;
      if (existingIds.has(variantId)) continue;
      existingIds.add(variantId);

      const variant: EffortModelEntry = {
        ...model,
        id: variantId,
        root: `${baseRoot}-${effort}`,
      };
      if (typeof model.name === "string" && model.name) {
        variant.name = `${model.name} (${formatEffortLabel(effort)})`;
      }
      variants.push(variant as T);
    }
  }

  return variants.length > 0 ? [...models, ...variants] : models;
}

/** Resolve a legacy effort alias only when its base model declares that exact tier. */
export function resolveKnownEffortVariant(
  modelId: string,
  models: readonly EffortModelEntry[]
): { baseModel: string; effort: string | null } {
  for (const candidate of models) {
    if (typeof candidate.id !== "string" || !candidate.id) continue;
    for (const effort of getDeclaredEfforts(candidate)) {
      if (effort !== "none" && modelId === `${candidate.id}-${effort}`) {
        return { baseModel: candidate.id, effort };
      }
    }
  }
  return { baseModel: modelId, effort: null };
}
