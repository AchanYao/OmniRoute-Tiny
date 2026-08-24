import { runWithProxyContext } from "../../../utils/proxyFetch.ts";
import { extractOAuthErrorCode } from "../shared.ts";
import { resolveCursorExpiresInSec } from "./cursorExpiry.ts";

/**
 * Specialized refresh for Cursor OAuth tokens (matching omp / Cursor API).
 * POST https://api2.cursor.sh/auth/exchange_user_api_key
 */
export async function refreshCursorToken(
  refreshToken: string,
  log?: { info?: Function; error?: Function; warn?: Function },
  proxyConfig: unknown = null
) {
  const endpoint = "https://api2.cursor.sh/auth/exchange_user_api_key";

  try {
    const response = await runWithProxyContext(proxyConfig, () =>
      fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${refreshToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: "{}",
      })
    );

    if (!response.ok) {
      const errorText = await response.text();
      log?.error?.("TOKEN_REFRESH", "Failed to refresh Cursor token", {
        status: response.status,
        error: errorText,
      });
      const code = extractOAuthErrorCode(errorText);
      if (response.status === 401 || response.status === 403 || code === "invalid_grant") {
        return { error: "unrecoverable_refresh_error", code: code || "invalid_grant" };
      }
      return null;
    }

    const data = (await response.json()) as Record<string, unknown>;
    const accessToken = typeof data?.accessToken === "string" ? data.accessToken : undefined;
    const nextRefreshToken =
      typeof data?.refreshToken === "string" ? data.refreshToken : refreshToken;
    const expiresIn = resolveCursorExpiresInSec({
      accessToken,
      expiresIn: data?.expiresIn,
      expires_in: data?.expires_in,
      expiresAt: data?.expiresAt,
      expires_at: data?.expires_at,
    });
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    log?.info?.("TOKEN_REFRESH", "Successfully refreshed Cursor token", {
      hasNewAccessToken: !!accessToken,
      hasNewRefreshToken: typeof data?.refreshToken === "string",
      expiresIn,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken: nextRefreshToken,
      expiresIn,
      expiresAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log?.error?.("TOKEN_REFRESH", `Network error refreshing Cursor token: ${message}`);
    return null;
  }
}
