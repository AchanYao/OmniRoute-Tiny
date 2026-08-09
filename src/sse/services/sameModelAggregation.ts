import { getAllCustomModels } from "@/lib/db/models";
import { getAllActiveSyncedModels } from "@/lib/db/models/activeSyncedCatalog";
import { getCachedProviderConnections } from "@/lib/db/readCache";
import { getSettings } from "@/lib/db/settings";
import { getHiddenModelsByProvider } from "@/models";
import { isModelExcludedByConnection } from "@/domain/connectionModelRules";
import { NOAUTH_PROVIDERS } from "@/shared/constants/providers";
import { REGISTRY } from "@omniroute/open-sse/config/providerRegistry.ts";
import { PROVIDER_ID_TO_ALIAS } from "@omniroute/open-sse/config/providerModels.ts";
import { hasUsableWebSessionCredential } from "@/shared/providers/webSessionCredentials";
import {
  filterResilienceBlockedCandidates,
  SYNTHETIC_NOAUTH_CONNECTION_ID,
  type ConnectionResilienceView,
} from "@omniroute/open-sse/services/autoCombo/resilienceCandidateFilter.ts";
import { isModelLocked } from "@omniroute/open-sse/services/accountFallback.ts";

type Connection = ConnectionResilienceView & {
  provider: string;
  isActive?: boolean;
  defaultModel?: string | null;
  apiKey?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  providerSpecificData?: Record<string, unknown> | null;
};

type ModelEntry = { id?: unknown; supportedEndpoints?: unknown };

type SameModelCandidate = {
  provider: string;
  connectionId: string;
  model: string;
  modelStr: string;
};

export type SameModelAggregateCombo = {
  id: string;
  name: string;
  type: "same-model";
  strategy: "priority";
  models: Array<{
    id: string;
    kind: "model";
    model: string;
    providerId: string;
    connectionId: string;
    weight: number;
    label: string;
  }>;
};

function hasCredential(connection: Connection): boolean {
  return (
    (typeof connection.apiKey === "string" && connection.apiKey.trim().length > 0) ||
    (typeof connection.accessToken === "string" && connection.accessToken.trim().length > 0) ||
    (typeof connection.refreshToken === "string" && connection.refreshToken.trim().length > 0) ||
    hasUsableWebSessionCredential(connection.provider, connection.providerSpecificData)
  );
}

function containsChatModel(value: unknown, modelId: string): boolean {
  if (!Array.isArray(value)) return false;
  return value.some((entry: ModelEntry) => {
    if (entry?.id !== modelId) return false;
    return !Array.isArray(entry.supportedEndpoints) || entry.supportedEndpoints.includes("chat");
  });
}

function valuesForProvider(source: Record<string, unknown>, provider: string): unknown[] {
  const alias = PROVIDER_ID_TO_ALIAS[provider];
  return [source[provider], alias ? source[alias] : undefined];
}

function providerSupportsModel(
  connection: Connection,
  modelId: string,
  customModels: Record<string, unknown>,
  syncedModels: Record<string, unknown>
): boolean {
  if (connection.defaultModel?.trim() === modelId) return true;
  if (
    valuesForProvider(customModels, connection.provider).some((value) =>
      containsChatModel(value, modelId)
    )
  ) {
    return true;
  }
  if (
    valuesForProvider(syncedModels, connection.provider).some((value) =>
      containsChatModel(value, modelId)
    )
  ) {
    return true;
  }
  return containsChatModel(REGISTRY[connection.provider]?.models, modelId);
}

function isBlocked(provider: string, blockedProviders: Set<string>): boolean {
  const alias = PROVIDER_ID_TO_ALIAS[provider] || REGISTRY[provider]?.alias;
  return (
    blockedProviders.has(provider) || (typeof alias === "string" && blockedProviders.has(alias))
  );
}

function routingPrefix(provider: string): string {
  return PROVIDER_ID_TO_ALIAS[provider] || REGISTRY[provider]?.alias || provider;
}

function buildCombo(
  modelId: string,
  candidates: SameModelCandidate[]
): SameModelAggregateCombo | null {
  const providers = new Set(candidates.map((candidate) => candidate.provider));
  if (providers.size < 2) return null;

  return {
    id: `same-model:${modelId}`,
    name: modelId,
    type: "same-model",
    strategy: "priority",
    models: candidates.map((candidate, index) => ({
      id: `same-model-${index + 1}-${candidate.provider}-${candidate.connectionId}`,
      kind: "model",
      model: candidate.modelStr,
      providerId: candidate.provider,
      connectionId: candidate.connectionId,
      weight: 0,
      label: candidate.provider,
    })),
  };
}

/** Resolve an exact bare id to an in-memory priority Combo spanning active providers. */
export async function resolveSameModelAggregateCombo(
  requestedModel: string
): Promise<SameModelAggregateCombo | null> {
  const modelId = requestedModel.trim();
  if (!modelId || modelId.includes("/")) return null;

  const [activeRaw, inactiveRaw, settings, customRaw, syncedRaw] = await Promise.all([
    getCachedProviderConnections({ isActive: true }),
    getCachedProviderConnections({ isActive: false }),
    getSettings().catch(() => ({})),
    getAllCustomModels().catch(() => ({})),
    getAllActiveSyncedModels().catch(() => ({})),
  ]);
  const activeConnections = activeRaw as Connection[];
  const inactiveConnections = inactiveRaw as Connection[];
  const customModels = customRaw as Record<string, unknown>;
  const syncedModels = syncedRaw as Record<string, unknown>;
  const blockedProviders = new Set(
    Array.isArray((settings as Record<string, unknown>).blockedProviders)
      ? ((settings as Record<string, unknown>).blockedProviders as string[])
      : []
  );
  const hiddenModels = getHiddenModelsByProvider();
  const connectionById = new Map<string, ConnectionResilienceView>();
  for (const connection of [...activeConnections, ...inactiveConnections]) {
    connectionById.set(connection.id, connection);
  }

  const candidates: SameModelCandidate[] = [];
  for (const connection of activeConnections) {
    if (!hasCredential(connection) || isBlocked(connection.provider, blockedProviders)) continue;
    if (hiddenModels.get(connection.provider)?.has(modelId)) continue;
    if (isModelExcludedByConnection(modelId, connection.providerSpecificData)) continue;
    if (!providerSupportsModel(connection, modelId, customModels, syncedModels)) continue;
    candidates.push({
      provider: connection.provider,
      connectionId: connection.id,
      model: modelId,
      modelStr: `${routingPrefix(connection.provider)}/${modelId}`,
    });
  }

  const disabledNoAuthProviders = new Set(
    inactiveConnections
      .filter((connection) => connection.provider in NOAUTH_PROVIDERS)
      .map((connection) => connection.provider)
  );
  for (const providerDefinition of Object.values(NOAUTH_PROVIDERS)) {
    const provider = providerDefinition.id;
    if (
      !provider ||
      disabledNoAuthProviders.has(provider) ||
      isBlocked(provider, blockedProviders)
    ) {
      continue;
    }
    if (candidates.some((candidate) => candidate.provider === provider)) continue;
    if (hiddenModels.get(provider)?.has(modelId)) continue;
    if (!containsChatModel(REGISTRY[provider]?.models, modelId)) continue;
    if (isModelLocked(provider, SYNTHETIC_NOAUTH_CONNECTION_ID, modelId)) continue;
    candidates.push({
      provider,
      // The auth layer still returns the shared "noauth" credential sentinel, but
      // Combo stickiness needs a provider-specific identity so two keyless backends
      // cannot steal each other's session pin.
      connectionId: `${SYNTHETIC_NOAUTH_CONNECTION_ID}:${provider}`,
      model: modelId,
      modelStr: `${routingPrefix(provider)}/${modelId}`,
    });
  }

  const available = filterResilienceBlockedCandidates(candidates, connectionById);
  return buildCombo(modelId, available);
}
