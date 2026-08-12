type CatalogModel = Record<string, any>;

const LIMIT_FIELDS = ["context_length", "max_input_tokens", "max_output_tokens"] as const;

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

function commonFields(models: CatalogModel[]): CatalogModel {
  const first = models[0] || {};
  const common: CatalogModel = {};
  for (const [key, value] of Object.entries(first)) {
    if (["id", "root", "owned_by", "parent", "permission", ...LIMIT_FIELDS].includes(key)) {
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
