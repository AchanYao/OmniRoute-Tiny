import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getProvider } from "../../src/lib/oauth/providers";
import { CURSOR_OAUTH_CONFIG } from "../../src/lib/oauth/constants/oauth";
import { refreshCursorToken } from "../../open-sse/services/tokenRefresh/providers/cursor";
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

  it("refreshCursorToken calls exchange_user_api_key endpoint and returns new tokens", async () => {
    const originalFetch = globalThis.fetch;
    let capturedUrl = "";
    let capturedAuthHeader = "";

    try {
      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        capturedUrl = String(url);
        capturedAuthHeader = String(
          (init?.headers as Record<string, string>)?.["Authorization"] || ""
        );
        return new Response(
          JSON.stringify({
            accessToken: "new-access-token",
            refreshToken: "new-refresh-token",
          }),
          { status: 200 }
        );
      }) as typeof fetch;

      const res = await refreshCursorToken("existing-refresh-token");

      assert.equal(capturedUrl, "https://api2.cursor.sh/auth/exchange_user_api_key");
      assert.equal(capturedAuthHeader, "Bearer existing-refresh-token");
      assert.equal(res?.accessToken, "new-access-token");
      assert.equal(res?.refreshToken, "new-refresh-token");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("supportsTokenRefresh includes cursor and cursor-oauth", () => {
    assert.equal(supportsTokenRefresh("cursor"), true);
    assert.equal(supportsTokenRefresh("cursor-oauth"), true);
  });

  it("exposes clean static base models for cursor and cursor-oauth without suffix splitting", () => {
    const oauthModels = getStaticModelsForProvider("cursor-oauth");
    assert.ok(Array.isArray(oauthModels) && oauthModels.length > 0);
    assert.ok(oauthModels.some((m) => m.id === "composer-2.5"));
    assert.ok(oauthModels.some((m) => m.id === "gpt-5.5"));
  });
});
