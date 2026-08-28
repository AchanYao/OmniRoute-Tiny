// Pure, shared helpers for provider credential copy (labels/hints/titles for
// the API-key modal). Extracted out of providerPageHelpers.ts (Issue #3501
// strangler-fig decomposition). Leaf module — imports only from colocated
// siblings that are themselves acyclic.
export type ProviderMessageTranslator = ((
  key: string,
  values?: Record<string, unknown>
) => string) & {
  has?: (key: string) => boolean;
};

export function providerText(
  t: ProviderMessageTranslator,
  key: string,
  fallback: string,
  values?: Record<string, unknown>
): string {
  if (typeof t.has === "function" && t.has(key)) {
    return t(key, values);
  }
  if (values) {
    return Object.entries(values).reduce(
      (acc, [name, value]) => acc.replaceAll(`{${name}}`, String(value)),
      fallback
    );
  }
  return fallback;
}

export function getAddCredentialModalTitle(
  t: ProviderMessageTranslator,
  providerName: string,
  _requirement: unknown = null
): string {
  void _requirement;
  return t("addProviderApiKeyTitle", { provider: providerName });
}
