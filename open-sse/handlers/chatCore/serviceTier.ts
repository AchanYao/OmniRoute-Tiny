/**
 * chatCore service-tier resolvers (Quality Gate v2 / Fase 9 — chatCore god-file
 * decomposition, #3501).
 *
 * Pure, side-effect-free extraction of the two service-tier resolvers that used to be inline
 * closures at the top of handleChatCore. Codex and xAI-family providers read the client-supplied
 * `service_tier`, normalize it, and fall back to per-connection request defaults.
 */

import {
  getCodexRequestDefaults,
  getXaiRequestDefaults,
  isXaiServiceTierProvider,
  normalizeCodexServiceTier,
  normalizeXaiServiceTier,
  type CodexServiceTier,
  type XaiServiceTier,
} from "@/lib/providers/requestDefaults";

/** The effective service tier carried through a request. */
export type EffectiveServiceTier = "standard" | CodexServiceTier | XaiServiceTier;

/**
 * Resolve the effective service tier for the outbound request. A valid client `service_tier` wins;
 * otherwise the per-connection request default applies, falling back to "standard".
 */
export function resolveEffectiveServiceTier(
  provider: string | null | undefined,
  providerSpecificData: unknown,
  requestBody?: unknown
): EffectiveServiceTier {
  const isCodex = provider === "codex";
  const isXai = isXaiServiceTierProvider(provider);
  if (!isCodex && !isXai) return "standard";
  const requestRecord =
    requestBody && typeof requestBody === "object" && !Array.isArray(requestBody)
      ? (requestBody as Record<string, unknown>)
      : {};
  const rawServiceTier = requestRecord.service_tier;
  if (typeof rawServiceTier === "string" && rawServiceTier.trim().length > 0) {
    const normalizedServiceTier = isCodex
      ? normalizeCodexServiceTier(rawServiceTier)
      : normalizeXaiServiceTier(rawServiceTier);
    if (normalizedServiceTier) {
      return !isCodex && normalizedServiceTier === "default" ? "standard" : normalizedServiceTier;
    }
  }
  if (isCodex) return getCodexRequestDefaults(providerSpecificData).serviceTier ?? "standard";
  return getXaiRequestDefaults(provider, providerSpecificData).serviceTier === "priority"
    ? "priority"
    : "standard";
}

/**
 * Resolve the service tier reported by the upstream response. Codex keeps the previous tier when
 * no report is present. xAI-family providers deliberately return "standard" when priority is not
 * confirmed, preventing priority billing when upstream falls back or omits the echo.
 */
export function resolveReportedServiceTier(
  provider: string | null | undefined,
  payload?: unknown,
  maxDepth = 3
): EffectiveServiceTier | null {
  const isXai = isXaiServiceTierProvider(provider);
  if (maxDepth <= 0 || (provider !== "codex" && !isXai)) {
    return null;
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return isXai ? "standard" : null;
  }
  const record = payload as Record<string, unknown>;
  const rawServiceTier = record.service_tier;
  if (typeof rawServiceTier === "string" && rawServiceTier.trim().length > 0) {
    const normalizedServiceTier =
      provider === "codex"
        ? normalizeCodexServiceTier(rawServiceTier)
        : normalizeXaiServiceTier(rawServiceTier);
    if (normalizedServiceTier) {
      return isXai && normalizedServiceTier === "default" ? "standard" : normalizedServiceTier;
    }
  }
  if (record.response !== undefined) {
    const nested = resolveReportedServiceTier(provider, record.response, maxDepth - 1);
    if (nested === "priority" || nested === "flex") return nested;
  }
  return isXai ? "standard" : null;
}
