import { buildJulesApiUrl } from "@/lib/cloudAgent/julesApi.ts";
import { toValidationErrorResult, validationWrite } from "./transport";

/** Jules API — GET /v1alpha/sources with X-Goog-Api-Key (see developers.google.com/jules/api). */
export async function validateJulesProvider({ apiKey }: { apiKey: string }) {
  try {
    const response = await validationWrite(buildJulesApiUrl("/sources"), {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey,
      },
    });

    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }

    if (response.ok) {
      return { valid: true, error: null };
    }

    const errorText = await response.text().catch(() => "");
    return {
      valid: false,
      error: errorText.trim() || `Jules API returned ${response.status}`,
    };
  } catch (error: unknown) {
    return toValidationErrorResult(error);
  }
}

/**
 * Devin cloud-agent (Cognition) — GET /v1/sessions with Bearer auth
 * (see docs.devin.ai/api-reference/sessions/list-sessions). Distinct from the
 * "devin-cli" LLM provider (ACP), which is already wired via providerRegistry.
 */
export async function validateDevinCloudAgentProvider({ apiKey }: { apiKey: string }) {
  try {
    const response = await validationWrite("https://api.devin.ai/v1/sessions?limit=1", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }

    if (response.ok) {
      return { valid: true, error: null };
    }

    const errorText = await response.text().catch(() => "");
    return {
      valid: false,
      error: errorText.trim() || `Devin API returned ${response.status}`,
    };
  } catch (error: unknown) {
    return toValidationErrorResult(error);
  }
}
