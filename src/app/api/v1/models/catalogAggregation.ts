type CatalogModel = Record<string, any>;

const LIMIT_FIELDS = ["context_length", "max_input_tokens", "max_output_tokens"] as const;
const BOOLEAN_CAPABILITY_KEYS = [
  "reasoning",
  "thinking",
  "supportsThinking",
  "vision",
  "tool_calling",
] as const;
const MODALITY_FIELDS = ["input_modalities", "output_modalities"] as const;
const PREFERRED_EFFORT_ORDER = ["xhigh", "high", "medium", "low", "minimal"] as const;

function isChatModel(model: CatalogModel): boolean {
  return !model.type || model.type === "chat";
}

function getAggregateRoot(model: CatalogModel): string | null {
  if (!isChatModel(model) || model.owned_by === "combo" || model.owned_by === "aggregate") {
    return null;
  }
  if (typeof model.id !== "string" || typeof model.root !== "string") return null;
  if (
    !model.root ||
    model.root.includes("/") ||
    model.id === model.root ||
    !model.id.endsWith(`/${model.root}`)
  ) {
    return null;
  }
  return model.root;
}

function getProviderIdentity(
  model: CatalogModel,
  ownerById: ReadonlyMap<string, string>
): string | null {
  if (typeof model.parent === "string") {
    const parentOwner = ownerById.get(model.parent);
    if (parentOwner) return parentOwner;
  }
  return typeof model.owned_by === "string" && model.owned_by.length > 0 ? model.owned_by : null;
}

function minKnownNumber(models: CatalogModel[], field: (typeof LIMIT_FIELDS)[number]) {
  const values = models
    .map((model) => model[field])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return values.length > 0 ? Math.min(...values) : undefined;
}

function richestNonEmptyString(models: CatalogModel[], field: "name" | "description") {
  let richest: string | undefined;
  for (const model of models) {
    const value = model[field];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (!richest || trimmed.length > richest.length) richest = trimmed;
  }
  return richest;
}

function unionStringValues(values: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!Array.isArray(value)) continue;
    for (const entry of value) {
      if (typeof entry !== "string" || entry.length === 0 || seen.has(entry)) continue;
      seen.add(entry);
      result.push(entry);
    }
  }
  return result;
}

function orderEffortTiers(efforts: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const preferred of PREFERRED_EFFORT_ORDER) {
    if (!efforts.includes(preferred) || seen.has(preferred)) continue;
    seen.add(preferred);
    ordered.push(preferred);
  }
  for (const effort of efforts) {
    if (seen.has(effort)) continue;
    seen.add(effort);
    ordered.push(effort);
  }
  return ordered;
}

function mergeAggregateCapabilities(models: CatalogModel[]): Record<string, unknown> | undefined {
  const capabilities: Record<string, unknown> = {};
  for (const key of BOOLEAN_CAPABILITY_KEYS) {
    if (models.some((model) => model.capabilities?.[key] === true)) {
      capabilities[key] = true;
    }
  }
  const effortTiers = orderEffortTiers(
    unionStringValues([
      ...models.map((model) => model.capabilities?.effort_tiers),
      ...models.map((model) => model.supportedThinkingEfforts),
    ])
  );
  if (effortTiers.length > 0) {
    capabilities.effort_tiers = effortTiers;
    // Synced catalog members often carry only effort_tiers (buildSyncedCapabilities)
    // and aggregate entries skip enrichCatalogModelEntry. Infer the thinking flags
    // Playground/OMP clients gate on so unioned tiers stay usable.
    capabilities.supportsThinking = true;
    capabilities.thinking = true;
    capabilities.reasoning = true;
  }
  return Object.keys(capabilities).length > 0 ? capabilities : undefined;
}

function commonFields(models: CatalogModel[]): CatalogModel {
  const first = models[0] || {};
  const common: CatalogModel = {};
  for (const [key, value] of Object.entries(first)) {
    if (
      [
        "id",
        "root",
        "owned_by",
        "parent",
        "permission",
        "name",
        "description",
        "capabilities",
        ...LIMIT_FIELDS,
        ...MODALITY_FIELDS,
      ].includes(key)
    ) {
      continue;
    }
    if (models.every((model) => JSON.stringify(model[key]) === JSON.stringify(value))) {
      common[key] = value;
    }
  }
  return common;
}

function buildAggregateModel(
  root: string,
  models: CatalogModel[],
  ownerById: ReadonlyMap<string, string>
): CatalogModel {
  const aggregate: CatalogModel = {
    ...commonFields(models),
    id: root,
    object: "model",
    owned_by: "aggregate",
    permission: [],
    root,
    parent: null,
    providers: Array.from(
      new Set(
        models
          .map((model) => getProviderIdentity(model, ownerById))
          .filter((value): value is string => Boolean(value))
      )
    ),
  };

  const name = richestNonEmptyString(models, "name");
  const description = richestNonEmptyString(models, "description");
  if (name) aggregate.name = name;
  if (description) aggregate.description = description;

  for (const field of MODALITY_FIELDS) {
    const values = unionStringValues(models.map((model) => model[field]));
    if (values.length > 0) aggregate[field] = values;
  }

  const capabilities = mergeAggregateCapabilities(models);
  if (capabilities) aggregate.capabilities = capabilities;

  for (const field of LIMIT_FIELDS) {
    const value = minKnownNumber(models, field);
    if (value !== undefined) aggregate[field] = value;
  }
  return aggregate;
}

/**
 * Collapse provider-prefixed chat entries that share one exact raw model id.
 * Provider-prefixed routes remain executable; this only changes catalog publication.
 */
export function aggregateExactSameIdModels(models: CatalogModel[]): CatalogModel[] {
  if (!Array.isArray(models) || models.length < 2) return models;

  const ownerById = new Map<string, string>();
  for (const model of models) {
    if (typeof model.id === "string" && typeof model.owned_by === "string") {
      ownerById.set(model.id, model.owned_by);
    }
  }
  const membersByRoot = new Map<string, CatalogModel[]>();
  const explicitRoots = new Set<string>();
  for (const model of models) {
    if (typeof model.id === "string" && model.id === model.root) {
      explicitRoots.add(model.id);
    }
    const root = getAggregateRoot(model);
    if (!root) continue;
    const members = membersByRoot.get(root) || [];
    members.push(model);
    membersByRoot.set(root, members);
  }

  const aggregateRoots = new Set<string>();
  for (const [root, members] of membersByRoot) {
    const providers = new Set(
      members.map((model) => getProviderIdentity(model, ownerById)).filter(Boolean)
    );
    if (providers.size >= 2) aggregateRoots.add(root);
  }
  if (aggregateRoots.size === 0) return models;

  const emitted = new Set<string>();
  const output: CatalogModel[] = [];
  for (const model of models) {
    const root = getAggregateRoot(model);
    if (!root || !aggregateRoots.has(root)) {
      output.push(model);
      continue;
    }

    if (explicitRoots.has(root) || emitted.has(root)) continue;
    emitted.add(root);
    output.push(buildAggregateModel(root, membersByRoot.get(root) || [], ownerById));
  }
  return output;
}
