import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getProvider } from "../../src/lib/oauth/providers";
import { CURSOR_OAUTH_CONFIG } from "../../src/lib/oauth/constants/oauth";
import {
  CURSOR_API_KEY_EXCHANGE_URL,
  CURSOR_OAUTH_CLIENT_ID,
  CURSOR_OAUTH_TOKEN_URL,
  refreshCursorToken,
} from "../../open-sse/services/tokenRefresh/providers/cursor";
import { supportsTokenRefresh } from "../../open-sse/services/tokenRefresh";
import { getStaticModelsForProvider } from "../../src/lib/providers/staticModels";

describe("Cursor Provider Separation (IDE vs OAuth group)", () => {
  it("original cursor provider is restored as IDE group import_token flow", () => {
    const provider = getProvider("cursor");
    assert.equal(provider.flowType, "import_token");
  });

  it("new cursor-oauth provider is registered with device_code flowType under OAuth group", () => {
    const provider = getProvider("cursor-oauth");
    assert.equal(provider.flowType, "device_code");
    assert.equal(typeof provider.requestDeviceCode, "function");
    assert.equal(typeof provider.pollToken, "function");
  });

  it("requestDeviceCode generates valid PKCE loginUrl and device_code for cursor-oauth", async () => {
    const provider = getProvider("cursor-oauth");
    const result = await provider.requestDeviceCode(CURSOR_OAUTH_CONFIG);

    assert.ok(result.device_code.includes(":"));
    assert.equal(result.user_code, "");
    assert.ok(result.verification_uri.startsWith("https://cursor.com/loginDeepControl"));
    assert.ok(result.verification_uri.includes("challenge="));
    assert.ok(result.verification_uri.includes("uuid="));
    assert.equal(result.interval, 2);
    assert.equal(result.expires_in, 300);
  });

  it("pollToken handles 404 as authorization_pending for cursor-oauth", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = (async () => {
        return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
      }) as typeof fetch;

      const provider = getProvider("cursor-oauth");
      const pollRes = await provider.pollToken(CURSOR_OAUTH_CONFIG, "test-uuid:test-verifier");

      assert.equal(pollRes.ok, false);
      assert.equal(pollRes.data.error, "authorization_pending");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("pollToken maps 200 OK response with accessToken and refreshToken for cursor-oauth", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = (async () => {
        return new Response(
          JSON.stringify({
            accessToken: "mock-access-token",
            refreshToken: "mock-refresh-token",
          }),
          { status: 200 }
        );
      }) as typeof fetch;

      const provider = getProvider("cursor-oauth");
      const pollRes = await provider.pollToken(CURSOR_OAUTH_CONFIG, "test-uuid:test-verifier");

      assert.equal(pollRes.ok, true);
      assert.equal(pollRes.data.access_token, "mock-access-token");
      assert.equal(pollRes.data.refresh_token, "mock-refresh-token");

      const mapped = provider.mapTokens(pollRes.data);
      assert.equal(mapped.accessToken, "mock-access-token");
      assert.equal(mapped.refreshToken, "mock-refresh-token");
      assert.equal(mapped.providerSpecificData.authMethod, "oauth");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("refreshCursorToken posts grant_type refresh_token to /oauth/token and reads snake_case", async () => {
    const originalFetch = globalThis.fetch;
    let capturedUrl = "";
    let capturedBody = "";

    try {
      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        capturedUrl = String(url);
        capturedBody = String(init?.body || "");
        return new Response(
          JSON.stringify({
            access_token: "new-access-token",
            refresh_token: "new-refresh-token",
          }),
          { status: 200 }
        );
      }) as typeof fetch;

      const res = await refreshCursorToken("existing-refresh-token");

      assert.equal(capturedUrl, CURSOR_OAUTH_TOKEN_URL);
      const body = JSON.parse(capturedBody) as Record<string, string>;
      assert.equal(body.grant_type, "refresh_token");
      assert.equal(body.client_id, CURSOR_OAUTH_CLIENT_ID);
      assert.equal(body.refresh_token, "existing-refresh-token");
      assert.equal(res?.accessToken, "new-access-token");
      assert.equal(res?.refreshToken, "new-refresh-token");
      // Opaque non-JWT access tokens keep the historical 24h fallback.
      assert.equal(res?.expiresIn, 86400);
      assert.ok(typeof res?.expiresAt === "string");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("refreshCursorToken treats shouldLogout as unrecoverable without API-key fallback", async () => {
    const originalFetch = globalThis.fetch;
    const urls: string[] = [];

    try {
      globalThis.fetch = (async (url: string | URL | Request) => {
        urls.push(String(url));
        return new Response(JSON.stringify({ access_token: "", shouldLogout: true }), {
          status: 200,
        });
      }) as typeof fetch;

      const res = await refreshCursorToken("dead-refresh-token");
      assert.equal(urls.length, 1);
      assert.equal(urls[0], CURSOR_OAUTH_TOKEN_URL);
      assert.equal(res?.error, "unrecoverable_refresh_error");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("refreshCursorToken falls back to API-key exchange when /oauth/token rejects", async () => {
    const originalFetch = globalThis.fetch;
    const urls: string[] = [];

    try {
      globalThis.fetch = (async (url: string | URL | Request) => {
        urls.push(String(url));
        if (String(url) === CURSOR_OAUTH_TOKEN_URL) {
          return new Response("invalid_grant", { status: 401 });
        }
        return new Response(
          JSON.stringify({
            accessToken: "exchanged-access-token",
            refreshToken: "exchanged-refresh-token",
          }),
          { status: 200 }
        );
      }) as typeof fetch;

      const res = await refreshCursorToken("user-api-key");
      assert.deepEqual(urls, [CURSOR_OAUTH_TOKEN_URL, CURSOR_API_KEY_EXCHANGE_URL]);
      assert.equal(res?.accessToken, "exchanged-access-token");
      assert.equal(res?.refreshToken, "exchanged-refresh-token");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("refreshCursorToken does not fall back on transient /oauth/token failures", async () => {
    const originalFetch = globalThis.fetch;
    const urls: string[] = [];

    try {
      globalThis.fetch = (async (url: string | URL | Request) => {
        urls.push(String(url));
        return new Response("rate limited", { status: 429 });
      }) as typeof fetch;

      const res = await refreshCursorToken("pkce-refresh-token");
      assert.deepEqual(urls, [CURSOR_OAUTH_TOKEN_URL]);
      assert.equal(res, null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("refreshCursorToken does not fall back on /oauth/token 5xx", async () => {
    const originalFetch = globalThis.fetch;
    const urls: string[] = [];

    try {
      globalThis.fetch = (async (url: string | URL | Request) => {
        urls.push(String(url));
        return new Response("upstream unavailable", { status: 503 });
      }) as typeof fetch;

      const res = await refreshCursorToken("pkce-refresh-token");
      assert.deepEqual(urls, [CURSOR_OAUTH_TOKEN_URL]);
      assert.equal(res, null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("refreshCursorToken empty /oauth/token 200 does not treat API-key 401 as unrecoverable", async () => {
    const originalFetch = globalThis.fetch;
    const urls: string[] = [];

    try {
      globalThis.fetch = (async (url: string | URL | Request) => {
        urls.push(String(url));
        if (String(url) === CURSOR_OAUTH_TOKEN_URL) {
          return new Response(JSON.stringify({ access_token: "" }), { status: 200 });
        }
        return new Response("unauthorized", { status: 401 });
      }) as typeof fetch;

      const res = await refreshCursorToken("pkce-refresh-token");
      assert.deepEqual(urls, [CURSOR_OAUTH_TOKEN_URL, CURSOR_API_KEY_EXCHANGE_URL]);
      assert.equal(res, null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("supportsTokenRefresh includes cursor and cursor-oauth", () => {
    assert.equal(supportsTokenRefresh("cursor"), true);
    assert.equal(supportsTokenRefresh("cursor-oauth"), true);
  });
});
