import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getProvider } from "../../src/lib/oauth/providers";
import { refreshCursorToken } from "../../open-sse/services/tokenRefresh/providers/cursor";
import {
  CURSOR_DEFAULT_EXPIRES_IN_SEC,
  resolveCursorExpiresInSec,
} from "../../open-sse/services/tokenRefresh/providers/cursorExpiry";
import {
  ensureFreshCursorCredentials,
  cursorCredentialsNeedRefresh,
  refreshCursorExecutorCredentials,
} from "../../open-sse/executors/cursor/credentials";
import {
  getEffectiveCursorExpiryMs,
  isCursorFamilyProvider,
} from "../../open-sse/services/tokenRefresh/providers/cursorExpiry";
import type { ProviderCredentials } from "../../open-sse/executors/base";

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

describe("Cursor token expiry + refresh", () => {
  it("resolveCursorExpiresInSec prefers JWT exp over the 24h fallback", () => {
    const nowMs = Date.UTC(2026, 7, 24, 12, 0, 0);
    const expSec = Math.floor(nowMs / 1000) + 1800; // 30 minutes
    const token = makeJwt({ exp: expSec, sub: "user_01" });

    assert.equal(
      resolveCursorExpiresInSec({ accessToken: token, nowMs }),
      1800,
      "should read remaining lifetime from JWT exp"
    );
  });

  it("resolveCursorExpiresInSec accepts userId::jwt WorkOS form", () => {
    const nowMs = Date.UTC(2026, 7, 24, 12, 0, 0);
    const expSec = Math.floor(nowMs / 1000) + 900;
    const token = `user_01ABC::${makeJwt({ exp: expSec })}`;

    assert.equal(resolveCursorExpiresInSec({ accessToken: token, nowMs }), 900);
  });

  it("resolveCursorExpiresInSec clamps already-expired tokens to 1s", () => {
    const nowMs = Date.UTC(2026, 7, 24, 12, 0, 0);
    const expSec = Math.floor(nowMs / 1000) - 60;
    const token = makeJwt({ exp: expSec });

    assert.equal(resolveCursorExpiresInSec({ accessToken: token, nowMs }), 1);
  });

  it("resolveCursorExpiresInSec falls back to 86400 without JWT/explicit expiry", () => {
    assert.equal(
      resolveCursorExpiresInSec({ accessToken: "not-a-jwt" }),
      CURSOR_DEFAULT_EXPIRES_IN_SEC
    );
  });

  it("mapTokens derives expiresIn from JWT exp instead of hardcoding 86400", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const expSec = nowSec + 1200;
    const token = makeJwt({ exp: expSec, sub: "user_map" });
    const provider = getProvider("cursor-oauth");
    const mapped = provider.mapTokens({
      access_token: token,
      refresh_token: "rt-1",
    });

    assert.ok(mapped.expiresIn <= 1200);
    assert.ok(mapped.expiresIn >= 1190, `expected ~1200s, got ${mapped.expiresIn}`);
    assert.notEqual(mapped.expiresIn, 86400);
  });

  it("refreshCursorToken returns expiresIn/expiresAt from JWT exp", async () => {
    const originalFetch = globalThis.fetch;
    const nowSec = Math.floor(Date.now() / 1000);
    const expSec = nowSec + 2400;
    const freshAccess = makeJwt({ exp: expSec, sub: "user_refresh" });

    try {
      globalThis.fetch = (async () =>
        new Response(
          JSON.stringify({
            accessToken: freshAccess,
            refreshToken: "new-refresh-token",
          }),
          { status: 200 }
        )) as typeof fetch;

      const res = await refreshCursorToken("existing-refresh-token");
      assert.equal(res?.accessToken, freshAccess);
      assert.equal(res?.refreshToken, "new-refresh-token");
      assert.ok(typeof res?.expiresIn === "number");
      assert.ok((res?.expiresIn ?? 0) <= 2400);
      assert.ok((res?.expiresIn ?? 0) >= 2390);
      assert.ok(typeof res?.expiresAt === "string");
      const expiresAtMs = Date.parse(String(res?.expiresAt));
      assert.ok(Number.isFinite(expiresAtMs));
      assert.ok(expiresAtMs > Date.now() + 2300_000);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("refreshCursorToken reads JWT exp from snake_case /oauth/token payloads", async () => {
    const originalFetch = globalThis.fetch;
    const nowSec = Math.floor(Date.now() / 1000);
    const expSec = nowSec + 1800;
    const freshAccess = makeJwt({ exp: expSec, sub: "user_oauth" });

    try {
      globalThis.fetch = (async () =>
        new Response(
          JSON.stringify({
            access_token: freshAccess,
            shouldLogout: false,
          }),
          { status: 200 }
        )) as typeof fetch;

      const res = await refreshCursorToken("pkce-refresh-token");
      assert.equal(res?.accessToken, freshAccess);
      assert.equal(res?.refreshToken, "pkce-refresh-token");
      assert.ok((res?.expiresIn ?? 0) <= 1800);
      assert.ok((res?.expiresIn ?? 0) >= 1790);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("refreshCursorExecutorCredentials returns null without a refresh token", async () => {
    const result = await refreshCursorExecutorCredentials({ accessToken: "a" });
    assert.equal(result, null);
  });

  it("refreshCursorExecutorCredentials returns null on unrecoverable refresh", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = (async () =>
        new Response(JSON.stringify({ error: "invalid_grant" }), { status: 401 })) as typeof fetch;

      const result = await refreshCursorExecutorCredentials({
        accessToken: "stale",
        refreshToken: "dead-refresh",
      });
      assert.equal(result, null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("ensureFreshCursorCredentials refreshes near-expiry tokens and persists", async () => {
    let refreshCalls = 0;
    let persisted: Record<string, unknown> | null = null;
    const credentials: ProviderCredentials = {
      accessToken: "STALE",
      refreshToken: "rt",
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    };

    const fresh = await ensureFreshCursorCredentials({
      credentials,
      needsRefresh: () => true,
      refreshCredentials: async () => {
        refreshCalls += 1;
        return {
          accessToken: "FRESH",
          refreshToken: "rt2",
          expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        };
      },
      onCredentialsRefreshed: async (patch) => {
        persisted = patch;
      },
    });

    assert.equal(refreshCalls, 1);
    assert.equal(fresh.accessToken, "FRESH");
    assert.equal(persisted?.accessToken, "FRESH");
  });

  it("ensureFreshCursorCredentials skips refresh when token is still valid", async () => {
    let refreshCalls = 0;
    const credentials: ProviderCredentials = {
      accessToken: "GOOD",
      refreshToken: "rt",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    };

    const result = await ensureFreshCursorCredentials({
      credentials,
      needsRefresh: () => false,
      refreshCredentials: async () => {
        refreshCalls += 1;
        return { accessToken: "SHOULD_NOT" };
      },
    });

    assert.equal(refreshCalls, 0);
    assert.equal(result.accessToken, "GOOD");
  });

  it("cursorCredentialsNeedRefresh uses JWT exp even when stored expiresAt is far away", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const almostGone = makeJwt({ exp: nowSec + 30 }); // 30s left
    const credentials: ProviderCredentials = {
      accessToken: almostGone,
      refreshToken: "rt",
      // Fake historical 24h clock still "valid"
      expiresAt: new Date(Date.now() + 20 * 3600_000).toISOString(),
    };
    assert.equal(cursorCredentialsNeedRefresh(credentials), true);
  });

  it("cursorCredentialsNeedRefresh is false when both stored and JWT expiry are far", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const fresh = makeJwt({ exp: nowSec + 7200 });
    const credentials: ProviderCredentials = {
      accessToken: fresh,
      refreshToken: "rt",
      expiresAt: new Date(Date.now() + 7200_000).toISOString(),
    };
    assert.equal(cursorCredentialsNeedRefresh(credentials), false);
  });

  it("getEffectiveCursorExpiryMs picks the earlier of stored clock and JWT exp", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const jwtMs = (nowSec + 600) * 1000;
    const token = makeJwt({ exp: nowSec + 600 });
    const storedFar = new Date(Date.now() + 20 * 3600_000).toISOString();
    const effective = getEffectiveCursorExpiryMs(storedFar, token);
    assert.ok(Math.abs(effective - jwtMs) < 2000);
    assert.equal(isCursorFamilyProvider("cursor-oauth"), true);
    assert.equal(isCursorFamilyProvider("cuo"), true);
    assert.equal(isCursorFamilyProvider("codex"), false);
  });
});
