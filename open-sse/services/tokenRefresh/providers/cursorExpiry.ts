/**
 * Cursor access tokens are WorkOS JWTs (sometimes stored as `userId::jwt`).
 * Prefer the JWT `exp` claim over the historical hardcoded 86400s fallback so
 * proactive health-check / request-path refresh fires before the real expiry.
 */

export const CURSOR_DEFAULT_EXPIRES_IN_SEC = 86400;

/** Best-effort base64url JWT payload decode (no signature verification). */
export function decodeCursorJwtPayload(token: unknown): Record<string, unknown> | null {
  try {
    if (typeof token !== "string" || !token) return null;
    // Cursor sometimes stores WorkOS session cookies as `${userId}::${jwt}`.
    const jwt = token.includes("::") ? token.split("::").pop() || token : token;
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padding = (4 - (base64.length % 4)) % 4;
    const json = Buffer.from(`${base64}${"=".repeat(padding)}`, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function positiveSeconds(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.max(1, Math.floor(value));
}

function secondsUntil(absoluteMs: number, nowMs: number): number {
  return Math.max(1, Math.floor((absoluteMs - nowMs) / 1000));
}

/**
 * Absolute expiry ms for a Cursor access token.
 * Returns 0 when the token is missing/unparseable.
 */
export function getCursorAccessTokenExpiryMs(accessToken: unknown): number {
  const payload = decodeCursorJwtPayload(accessToken);
  const exp = payload && typeof payload.exp === "number" ? payload.exp : null;
  if (exp === null || !Number.isFinite(exp)) return 0;
  return exp * 1000;
}

/** True for Cursor family provider ids / aliases used in DB rows. */
export function isCursorFamilyProvider(provider: unknown): boolean {
  const id = String(provider || "").toLowerCase();
  return id === "cursor" || id === "cursor-oauth" || id === "cu" || id === "cuo";
}

/**
 * Effective absolute expiry ms for Cursor connections: the earlier of the
 * stored tokenExpiresAt/expiresAt clock and the access-token JWT exp.
 * Returns 0 when neither is available.
 */
export function getEffectiveCursorExpiryMs(storedExpiresAt: unknown, accessToken: unknown): number {
  let storedMs = 0;
  if (typeof storedExpiresAt === "string" && storedExpiresAt.trim()) {
    const parsed = new Date(storedExpiresAt).getTime();
    if (Number.isFinite(parsed)) storedMs = parsed;
  } else if (typeof storedExpiresAt === "number" && Number.isFinite(storedExpiresAt)) {
    storedMs = storedExpiresAt > 1e12 ? storedExpiresAt : storedExpiresAt * 1000;
  }
  const jwtMs = getCursorAccessTokenExpiryMs(accessToken);
  if (storedMs > 0 && jwtMs > 0) return Math.min(storedMs, jwtMs);
  return jwtMs > 0 ? jwtMs : storedMs;
}

/**
 * Resolve Cursor access-token lifetime in seconds.
 *
 * Precedence:
 *   1. Explicit upstream `expires_in` / `expiresIn`
 *   2. Absolute `expires_at` / `expiresAt` (unix sec/ms or ISO)
 *   3. JWT `exp` claim on the access token
 *   4. Historical 24h fallback
 *
 * Already-expired tokens clamp to 1s so the refresh path stays eligible
 * (same pattern as grok-cli #7610).
 */
export function resolveCursorExpiresInSec(options: {
  accessToken?: unknown;
  expiresIn?: unknown;
  expires_in?: unknown;
  expiresAt?: unknown;
  expires_at?: unknown;
  nowMs?: number;
}): number {
  const nowMs =
    typeof options.nowMs === "number" && Number.isFinite(options.nowMs)
      ? options.nowMs
      : Date.now();

  const fromRelative = positiveSeconds(options.expires_in) ?? positiveSeconds(options.expiresIn);
  if (fromRelative !== null) return fromRelative;

  for (const raw of [options.expires_at, options.expiresAt]) {
    if (typeof raw === "number" && Number.isFinite(raw)) {
      const absoluteMs = raw > 1e12 ? raw : raw * 1000;
      return secondsUntil(absoluteMs, nowMs);
    }
    if (typeof raw === "string" && raw.trim()) {
      const parsed = Date.parse(raw);
      if (!Number.isNaN(parsed)) return secondsUntil(parsed, nowMs);
    }
  }

  const jwtExpMs = getCursorAccessTokenExpiryMs(options.accessToken);
  if (jwtExpMs > 0) return secondsUntil(jwtExpMs, nowMs);

  return CURSOR_DEFAULT_EXPIRES_IN_SEC;
}
