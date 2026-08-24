/**
 * Cursor credential refresh helpers.
 *
 * Extracted from the frozen cursor.ts executor host so proactive / reactive
 * refresh can land without growing the god-file past its file-size ceiling.
 *
 * CursorExecutor overrides BaseExecutor.execute() for Connect-RPC/h2, so the
 * base-class proactive-refresh gate never runs. ensureFreshCursorCredentials
 * is the execute()-path equivalent of base.ts's needsRefresh branch.
 */

import {
  getAccessToken,
  getRefreshLeadMs,
  isUnrecoverableRefreshError,
  runWithOnPersist,
} from "../../services/tokenRefresh.ts";
import { getCursorAccessTokenExpiryMs } from "../../services/tokenRefresh/providers/cursorExpiry.ts";
import type { ExecutorLog, ProviderCredentials } from "../base.ts";

type CredentialPatch = Partial<ProviderCredentials> & Record<string, unknown>;

function asCredentialPatch(value: unknown): CredentialPatch | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as CredentialPatch;
}

function mergeCredentials(
  current: ProviderCredentials,
  patch: CredentialPatch
): ProviderCredentials {
  const providerSpecificData =
    patch.providerSpecificData &&
    typeof patch.providerSpecificData === "object" &&
    !Array.isArray(patch.providerSpecificData)
      ? {
          ...(current.providerSpecificData || {}),
          ...patch.providerSpecificData,
        }
      : current.providerSpecificData;

  return {
    ...current,
    ...patch,
    providerSpecificData,
  };
}

/**
 * Cursor-specific near-expiry check.
 * Prefer the earlier of stored expiresAt and the access-token JWT exp so a
 * historical fake 24h clock cannot hide a shorter real JWT lifetime.
 */
export function cursorCredentialsNeedRefresh(
  credentials?: ProviderCredentials | null,
  provider: string = "cursor-oauth"
): boolean {
  if (!credentials) return false;
  const lead = getRefreshLeadMs(provider, credentials.providerSpecificData || null);
  const now = Date.now();

  const candidates: number[] = [];
  if (credentials.expiresAt) {
    const stored = new Date(credentials.expiresAt).getTime();
    if (Number.isFinite(stored) && stored > 0) candidates.push(stored);
  }
  const jwtExp = getCursorAccessTokenExpiryMs(credentials.accessToken);
  if (jwtExp > 0) candidates.push(jwtExp);

  if (candidates.length === 0) {
    // No known expiry but we have a refresh token: still refresh so a legacy
    // connection without expiresAt does not silently die.
    return Boolean(credentials.refreshToken);
  }

  const earliest = Math.min(...candidates);
  return earliest - now < lead;
}

/**
 * Refresh Cursor OAuth credentials via the centralized token-refresh service.
 * Same contract as CodexExecutor.refreshCredentials: return null on failure so
 * callers keep the original credentials and the reactive 401 path can mark
 * expired only after upstream confirms.
 */
export async function refreshCursorExecutorCredentials(
  credentials: ProviderCredentials,
  log?: ExecutorLog | null
): Promise<CredentialPatch | null> {
  if (!credentials?.refreshToken) {
    log?.warn?.("TOKEN_REFRESH", "Cursor: no refresh token available, re-authentication required");
    return null;
  }

  // Both "cursor" and "cursor-oauth" dispatch to refreshCursorToken.
  const result = await getAccessToken("cursor-oauth", credentials, log);
  if (!result) {
    log?.warn?.("TOKEN_REFRESH", "Cursor: token refresh failed — re-authentication required");
    return null;
  }
  if (isUnrecoverableRefreshError(result)) {
    const code =
      result && typeof result === "object" && "error" in result
        ? String(result.error ?? "unknown")
        : "unknown";
    log?.warn?.(
      "TOKEN_REFRESH",
      `Cursor: token refresh failed (${code}) — re-authentication required`
    );
    return null;
  }
  return asCredentialPatch(result);
}

/**
 * If credentials are near expiry, refresh them before dispatch and optionally
 * persist via onCredentialsRefreshed (inside the getAccessToken mutex when
 * connectionId is present).
 */
export async function ensureFreshCursorCredentials(args: {
  credentials: ProviderCredentials;
  log?: ExecutorLog | null;
  onCredentialsRefreshed?: (patch: CredentialPatch) => Promise<void> | void;
  needsRefresh?: (credentials?: ProviderCredentials | null) => boolean;
  refreshCredentials?: (
    credentials: ProviderCredentials,
    log?: ExecutorLog | null
  ) => Promise<CredentialPatch | null>;
}): Promise<ProviderCredentials> {
  const {
    credentials,
    log,
    onCredentialsRefreshed,
    needsRefresh = cursorCredentialsNeedRefresh,
    refreshCredentials = refreshCursorExecutorCredentials,
  } = args;
  if (!needsRefresh(credentials)) return credentials;

  let activeCredentials = credentials;
  let proactivePersistRan = false;
  const proactiveOnPersist = onCredentialsRefreshed
    ? async (refreshResult: Record<string, unknown>) => {
        proactivePersistRan = true;
        const patch = asCredentialPatch(refreshResult);
        if (!patch) return;
        activeCredentials = mergeCredentials(credentials, patch);
        await onCredentialsRefreshed(patch);
      }
    : null;

  const refreshed = await runWithOnPersist(proactiveOnPersist, () =>
    refreshCredentials(credentials, log || null)
  );

  if (!refreshed) return activeCredentials;

  if (isUnrecoverableRefreshError(refreshed)) {
    log?.warn?.(
      "TOKEN",
      "CURSOR | proactive refresh returned unrecoverable sentinel; keeping stale credentials, deferring to reactive path."
    );
    return credentials;
  }

  if (!proactivePersistRan) {
    const patch = asCredentialPatch(refreshed);
    if (!patch) return activeCredentials;
    activeCredentials = mergeCredentials(credentials, patch);
    if (onCredentialsRefreshed) {
      await onCredentialsRefreshed(patch);
    }
  }

  return activeCredentials;
}
