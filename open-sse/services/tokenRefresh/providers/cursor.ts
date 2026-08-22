import { runWithProxyContext } from "../../../utils/proxyFetch.ts";
import { extractOAuthErrorCode } from "../shared.ts";

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
    log?.info?.("TOKEN_REFRESH", "Successfully refreshed Cursor token", {
      hasNewAccessToken: !!data?.accessToken,
      hasNewRefreshToken: !!data?.refreshToken,
    });

    return {
      accessToken: typeof data?.accessToken === "string" ? data.accessToken : undefined,
      refreshToken: typeof data?.refreshToken === "string" ? data.refreshToken : refreshToken,
      expiresIn: 86400,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log?.error?.("TOKEN_REFRESH", `Network error refreshing Cursor token: ${message}`);
    return null;
  }
}
