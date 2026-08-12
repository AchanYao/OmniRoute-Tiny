import { getProviderModels } from "../config/providerModels.ts";
import { resolveKnownEffortVariant } from "../config/effortVariants.ts";

/**
 * Return the registered base model for an explicit effort variant.
 *
 * The base must exist in the provider registry and declare the requested tier.
 * The synthetic variant itself does not need a static registry row.
 */
export function getRegisteredProviderEffortBaseModelId(
  providerId: string,
  modelId: string
): string | null {
  const resolved = resolveKnownEffortVariant(modelId, getProviderModels(providerId));
  return resolved.effort ? resolved.baseModel : null;
}

export function isRegisteredProviderEffortVariant(providerId: string, modelId: string): boolean {
  return getRegisteredProviderEffortBaseModelId(providerId, modelId) !== null;
}
