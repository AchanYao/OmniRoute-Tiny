import { runWithProxyContext } from "../../../utils/proxyFetch.ts";
import { extractOAuthErrorCode } from "../shared.ts";
import { resolveCursorExpiresInSec } from "./cursorExpiry.ts";
import { resolvePublicCred } from "../../../utils/publicCreds.ts";

/**
 * Specialized refresh for Cursor tokens.
 *
 * PKCE / session refresh tokens (cursor-oauth) must POST
 * `https://api2.cursor.sh/oauth/token` with `grant_type=refresh_token`.
 * That endpoint returns snake_case `access_token` and may set
 * `shouldLogout: true` when the refresh token is dead.
 *
 * User API keys still exchange at `/auth/exchange_user_api_key`.
 * Trying the API-key endpoint first is what made cursor-oauth expire:
 * a PKCE refresh token is not a user API key, so the exchange 401s and
 * health-check marks the connection terminal.
 *
 * Fall back to the API-key exchange only when `/oauth/token` indicates the
 * credential is not an OAuth refresh token (401/403/`invalid_grant`). Transient
 * OAuth failures (408/429/5xx) must return null so health-check retries instead
 * of treating the expected API-key 401 as a dead grant.
 */
export const CURSOR_OAUTH_TOKEN_URL = "https://api2.cursor.sh/oauth/token";
export const CURSOR_API_KEY_EXCHANGE_URL = "https://api2.cursor.sh/auth/exchange_user_api_key";
/** Public Cursor CLI OAuth client id (not a secret). */
export const CURSOR_OAUTH_CLIENT_ID = resolvePublicCred("cursor_id", "CURSOR_OAUTH_CLIENT_ID");

type RefreshLog = { info?: Function; error?: Function; warn?: Function };

/** Cursor returns camelCase from poll/API-key exchange and snake_case from /oauth/token. */
export function pickCursorAccessToken(data: Record<string, unknown>): string | undefined {
  if (typeof data.accessToken === "string" && data.accessToken.trim()) return data.accessToken;
  if (typeof data.access_token === "string" && data.access_token.trim()) return data.access_token;
  return undefined;
}

export function isCursorLogoutResponse(data: Record<string, unknown>): boolean {
  return data.shouldLogout === true || data.should_logout === true;
}

function pickCursorRefreshToken(data: Record<string, unknown>, fallback: string): string {
  if (typeof data.refreshToken === "string" && data.refreshToken.trim()) return data.refreshToken;
  if (typeof data.refresh_token === "string" && data.refresh_token.trim())
    return data.refresh_token;
  return fallback;
}

function buildCursorRefreshResult(
  data: Record<string, unknown>,
  accessToken: string,
  refreshToken: string
) {
  const nextRefreshToken = pickCursorRefreshToken(data, refreshToken);
  const expiresIn = resolveCursorExpiresInSec({
    accessToken,
    expiresIn: data.expiresIn,
    expires_in: data.expires_in,
    expiresAt: data.expiresAt,
    expires_at: data.expires_at,
  });
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  return {
    accessToken,
    refreshToken: nextRefreshToken,
    expiresIn,
    expiresAt,
  };
}

const UNRECOVERABLE = { error: "unrecoverable_refresh_error", code: "invalid_grant" } as const;

function isTransientCursorRefreshStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function shouldTryApiKeyExchange(status: number, errorText: string): boolean {
  if (isTransientCursorRefreshStatus(status)) return false;
  const code = extractOAuthErrorCode(errorText);
  return (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    code === "invalid_grant" ||
    code === "invalid_client" ||
    code === "unsupported_grant_type"
  );
}

async function exchangeCursorUserApiKey(
  refreshToken: string,
  log: RefreshLog | undefined,
  proxyConfig: unknown,
  options: { authFailureUnrecoverable: boolean }
) {
  const exchangeResponse = await runWithProxyContext(proxyConfig, () =>
    fetch(CURSOR_API_KEY_EXCHANGE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${refreshToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: "{}",
    })
  );

  if (!exchangeResponse.ok) {
    const errorText = await exchangeResponse.text();
    log?.error?.("TOKEN_REFRESH", "Failed to refresh Cursor token", {
      status: exchangeResponse.status,
      error: errorText,
    });
    const code = extractOAuthErrorCode(errorText);
    if (
      options.authFailureUnrecoverable &&
      (exchangeResponse.status === 401 ||
        exchangeResponse.status === 403 ||
        code === "invalid_grant")
    ) {
      return { error: "unrecoverable_refresh_error", code: code || "invalid_grant" };
    }
    return null;
  }

  const exchangeData = (await exchangeResponse.json()) as Record<string, unknown>;
  if (isCursorLogoutResponse(exchangeData)) {
    return options.authFailureUnrecoverable ? { ...UNRECOVERABLE } : null;
  }
  const exchangedAccess = pickCursorAccessToken(exchangeData);
  if (!exchangedAccess) return null;
  const result = buildCursorRefreshResult(exchangeData, exchangedAccess, refreshToken);
  log?.info?.("TOKEN_REFRESH", "Successfully refreshed Cursor token", {
    hasNewAccessToken: true,
    hasNewRefreshToken: result.refreshToken !== refreshToken,
    via: "exchange_user_api_key",
    expiresIn: result.expiresIn,
    expiresAt: result.expiresAt,
  });
  return result;
}

export async function refreshCursorToken(
  refreshToken: string,
  log?: RefreshLog,
  proxyConfig: unknown = null
) {
  try {
    const oauthResponse = await runWithProxyContext(proxyConfig, () =>
      fetch(CURSOR_OAUTH_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          grant_type: "refresh_token",
          client_id: CURSOR_OAUTH_CLIENT_ID,
          refresh_token: refreshToken,
        }),
      })
    );

    if (oauthResponse.ok) {
      const data = (await oauthResponse.json()) as Record<string, unknown>;
      if (isCursorLogoutResponse(data)) {
        log?.error?.("TOKEN_REFRESH", "Cursor OAuth refresh requested logout", {
          status: oauthResponse.status,
        });
        return { ...UNRECOVERABLE };
      }
      const accessToken = pickCursorAccessToken(data);
      if (accessToken) {
        const result = buildCursorRefreshResult(data, accessToken, refreshToken);
        log?.info?.("TOKEN_REFRESH", "Successfully refreshed Cursor token", {
          hasNewAccessToken: true,
          hasNewRefreshToken: result.refreshToken !== refreshToken,
          via: "oauth/token",
          expiresIn: result.expiresIn,
          expiresAt: result.expiresAt,
        });
        return result;
      }
      // 200 without an access token and without shouldLogout is unknown, not a
      // dead grant. Try API-key exchange for imported keys, but a 401 there
      // must not become unrecoverable.
      return exchangeCursorUserApiKey(refreshToken, log, proxyConfig, {
        authFailureUnrecoverable: false,
      });
    }

    const errorText = await oauthResponse.text();
    log?.error?.("TOKEN_REFRESH", "Cursor OAuth token refresh failed", {
      status: oauthResponse.status,
      error: errorText,
    });

    if (!shouldTryApiKeyExchange(oauthResponse.status, errorText)) {
      return null;
    }

    // Imported user API keys are not valid at /oauth/token.
    return exchangeCursorUserApiKey(refreshToken, log, proxyConfig, {
      authFailureUnrecoverable: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log?.error?.("TOKEN_REFRESH", `Network error refreshing Cursor token: ${message}`);
    return null;
  }
}
