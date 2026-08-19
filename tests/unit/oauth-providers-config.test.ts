import test from "node:test";
import assert from "node:assert/strict";
import * as os from "node:os";

// Antigravity and Windsurf public defaults come from
// open-sse/utils/publicCreds.ts — no env override needed in this suite.
const originalEnv = { ...process.env };
Object.assign(process.env, {
  CLAUDE_OAUTH_CLIENT_ID: "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
  CODEX_OAUTH_CLIENT_ID: "app_EMoamEEZ73f0CkXaXp7hrann",
  GITLAB_DUO_OAUTH_CLIENT_ID: "gitlab-duo-client-id",
  KIMI_CODING_OAUTH_CLIENT_ID: "17e5f671-d194-4dfb-9706-5516cb48c098",
  KIMI_CODING_DEVICE_ID: "test-kimi-device-id",
  GITHUB_OAUTH_CLIENT_ID: "Iv1.b507a08c87ecfe98",
});
const providersModule = await import("../../src/lib/oauth/providers/index.ts");
const oauthModule = await import("../../src/lib/oauth/constants/oauth.ts");
const antigravityHeadersModule = await import("../../open-sse/services/antigravityHeaders.ts");
const oauthHelpersModule = await import("../../src/lib/oauth/providers.ts");

const PROVIDERS = providersModule.default;
const { resolveBrowserOAuthRedirectUri } = oauthHelpersModule;
const {
  ANTIGRAVITY_CONFIG,
  AGY_CONFIG,
  CLAUDE_CONFIG,
  CLINE_CONFIG,
  CODEX_CONFIG,
  CODEBUDDY_CN_CONFIG,
  ZED_CONFIG,
  CURSOR_CONFIG,
  GHE_COPILOT_CONFIG,
  GITHUB_CONFIG,
  GITLAB_DUO_CONFIG,
  GROK_BUILD_OAUTH_CONFIG,
  KILOCODE_CONFIG,
  KIMI_CODING_CONFIG,
  KIRO_CONFIG,
  OAUTH_TIMEOUT,
  PROVIDERS: OAUTH_PROVIDER_IDS,
  RAYCAST_CONFIG,
  TRAE_CONFIG,
  WINDSURF_CONFIG,
  XAI_OAUTH_CONFIG,
  ZED_HOSTED_CONFIG,
} = oauthModule;
const { getAntigravityLoadCodeAssistMetadata } = antigravityHeadersModule;

const originalFetch = globalThis.fetch;

const EXPECTED_PROVIDER_KEYS = [
  "claude",
  "codex",
  "antigravity",
  "agy",
  "kimi-coding",
  "github",
  "ghe-copilot",
  "gitlab-duo",
  "kiro",
  "amazon-q",
  "cursor",
  "trae",
  "raycast",
  "kilocode",
  "cline",
  "clinepass",
  "windsurf",
  "devin-cli",
  "grok-cli",
  "xai-oauth",
  "codebuddy-cn",
  "zed",
  "zed-hosted",
];

const browserUrl = "http://localhost:20128/callback";
const publicBaseEnv = {
  NEXT_PUBLIC_BASE_URL: "https://omniroute.example.com",
  ANTIGRAVITY_OAUTH_CLIENT_ID: "custom-antigravity.apps.googleusercontent.com",
  ANTIGRAVITY_OAUTH_CLIENT_SECRET: "custom-antigravity-secret",
};

const EXPECTED_CONFIG_BY_PROVIDER = {
  claude: CLAUDE_CONFIG,
  codex: CODEX_CONFIG,
  antigravity: ANTIGRAVITY_CONFIG,
  agy: AGY_CONFIG,
  "kimi-coding": KIMI_CODING_CONFIG,
  github: GITHUB_CONFIG,
  "ghe-copilot": GHE_COPILOT_CONFIG,
  "gitlab-duo": GITLAB_DUO_CONFIG,
  kiro: KIRO_CONFIG,
  "amazon-q": KIRO_CONFIG,
  cursor: CURSOR_CONFIG,
  kilocode: KILOCODE_CONFIG,
  cline: CLINE_CONFIG,
  clinepass: CLINE_CONFIG, // reuses the Cline WorkOS flow (clinepass: cline in providers/index.ts)
  windsurf: WINDSURF_CONFIG,
  "devin-cli": WINDSURF_CONFIG,
  raycast: RAYCAST_CONFIG,
  trae: TRAE_CONFIG,
  "grok-cli": GROK_BUILD_OAUTH_CONFIG,
  "xai-oauth": XAI_OAUTH_CONFIG,
  "codebuddy-cn": CODEBUDDY_CN_CONFIG,
  zed: ZED_CONFIG,
  "zed-hosted": ZED_HOSTED_CONFIG,
};

const KIRO_REQUIRED_FIELDS = [
  "registerClientUrl",
  "deviceAuthUrl",
  "tokenUrl",
  "socialAuthEndpoint",
  "socialLoginUrl",
  "socialTokenUrl",
  "socialRefreshUrl",
  "authMethods",
];

const REQUIRED_FIELDS_BY_PROVIDER = {
  claude: ["authorizeUrl", "tokenUrl", "redirectUri", "scopes", "clientId"],
  codex: ["authorizeUrl", "tokenUrl", "scope", "clientId"],
  antigravity: ["authorizeUrl", "tokenUrl", "userInfoUrl", "scopes", "clientId"],
  agy: ["authorizeUrl", "tokenUrl", "userInfoUrl", "scopes", "clientId"],
  "kimi-coding": ["deviceCodeUrl", "tokenUrl", "clientId"],
  github: ["deviceCodeUrl", "tokenUrl", "userInfoUrl", "copilotTokenUrl", "clientId"],
  // GHE Copilot derives its URLs at runtime from the per-connection gheUrl — only static fields.
  "ghe-copilot": ["clientId", "scopes", "apiVersion", "userAgent"],
  "gitlab-duo": [
    "baseUrl",
    "authorizeUrl",
    "tokenUrl",
    "userInfoUrl",
    "directAccessUrl",
    "scope",
    "codeChallengeMethod",
    "clientId",
  ],
  kiro: KIRO_REQUIRED_FIELDS,
  "amazon-q": KIRO_REQUIRED_FIELDS,
  cursor: ["apiEndpoint", "api3Endpoint", "agentEndpoint", "agentNonPrivacyEndpoint", "dbKeys"],
  kilocode: ["apiBaseUrl", "initiateUrl", "pollUrlBase"],
  cline: ["appBaseUrl", "apiBaseUrl", "authorizeUrl", "tokenExchangeUrl", "refreshUrl"],
  clinepass: ["appBaseUrl", "apiBaseUrl", "authorizeUrl", "tokenExchangeUrl", "refreshUrl"],
  windsurf: ["authorizeUrl", "apiServerUrl", "exchangePath", "inferenceUrl"],
  "devin-cli": ["authorizeUrl", "apiServerUrl", "exchangePath", "inferenceUrl"],
  trae: ["apiEndpoint", "chatEndpoint", "webUrl"],
  // prettier-ignore
  "xai-oauth": ["authorizeUrl", "tokenUrl", "scope", "codeChallengeMethod", "clientId", "loopbackPort", "callbackPath", "callbackHost"],
  // prettier-ignore
  "grok-cli": ["authorizeUrl", "tokenUrl", "scope", "codeChallengeMethod", "clientId", "loopbackPort", "callbackPath", "callbackHost"],
  // prettier-ignore
  "zed-hosted": ["webBaseUrl", "cloudBaseUrl", "llmBaseUrl", "userInfoUrl", "llmTokenUrl", "modelsUrl"],
};

function getByPath(object, path) {
  return path.split(".").reduce((value, segment) => value?.[segment], object);
}

function collectHttpsUrls(value, path = "config") {
  const results = [];

  if (typeof value === "string") {
    if (/^https?:\/\//.test(value)) {
      results.push({ path, value });
    }
    return results;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return results;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    results.push(...collectHttpsUrls(nestedValue, `${path}.${key}`));
  }

  return results;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function textResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain" },
  });
}

function createJwt(payload) {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url").replace(/=/g, "");

  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.signature`;
}

function useFetchSequence(sequence) {
  let index = 0;
  globalThis.fetch = async (...args) => {
    const next = sequence[index++];
    if (!next) {
      throw new Error(`Unexpected fetch call #${index}`);
    }
    return typeof next === "function" ? next(...args) : next;
  };
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});
test.after(() => {
  globalThis.fetch = originalFetch;
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, originalEnv);
});

test("OAuth provider registry exposes every expected provider exactly once", () => {
  assert.deepEqual(Object.keys(PROVIDERS), EXPECTED_PROVIDER_KEYS);
  assert.equal(new Set(Object.keys(PROVIDERS)).size, EXPECTED_PROVIDER_KEYS.length);
});

test("OAuth constants include all provider ids and use a sane timeout", () => {
  const constantIds = Object.values(OAUTH_PROVIDER_IDS);
  const registryIds = Object.keys(PROVIDERS);

  assert.ok(Number.isInteger(OAUTH_TIMEOUT));
  assert.ok(OAUTH_TIMEOUT > 0);
  assert.equal(new Set(constantIds).size, constantIds.length);

  for (const providerId of registryIds) {
    assert.ok(
      constantIds.includes(providerId),
      `Expected oauth constants to include provider id ${providerId}`
    );
  }
});

test("every registered OAuth provider has a valid config object, flow type and token mapper", () => {
  const allowedFlowTypes = new Set([
    "authorization_code",
    "authorization_code_pkce",
    "device_code",
    "import_token",
  ]);

  for (const [providerId, provider] of Object.entries(PROVIDERS)) {
    assert.equal(provider.config, EXPECTED_CONFIG_BY_PROVIDER[providerId]);
    assert.ok(allowedFlowTypes.has(provider.flowType), `${providerId} has unsupported flowType`);
    assert.equal(typeof provider.mapTokens, "function", `${providerId} must expose mapTokens`);

    const mapped = provider.mapTokens({});
    assert.ok(
      mapped && typeof mapped === "object",
      `${providerId} mapTokens must return an object`
    );
  }
});

test("every required provider config field is present when the provider is enabled for that flow", () => {
  for (const [providerId, fields] of Object.entries(REQUIRED_FIELDS_BY_PROVIDER)) {
    const provider = PROVIDERS[providerId];
    const config = provider.config;

    for (const field of fields) {
      const value = getByPath(config, field);

      assert.notEqual(value, undefined, `${providerId} missing config field ${field}`);

      if (Array.isArray(value)) {
        assert.ok(value.length > 0, `${providerId}.${field} must not be empty`);
      } else if (typeof value === "string") {
        assert.ok(value.length > 0, `${providerId}.${field} must not be empty`);
      } else if (typeof value === "object") {
        assert.ok(
          value && Object.keys(value).length > 0,
          `${providerId}.${field} must not be empty`
        );
      }
    }
  }
});

test("all provider endpoint URLs use HTTPS when a URL is configured", () => {
  for (const [providerId, provider] of Object.entries(PROVIDERS)) {
    const httpsUrls = collectHttpsUrls(provider.config);

    for (const entry of httpsUrls) {
      const parsed = new URL(entry.value);
      assert.equal(parsed.protocol, "https:", `${providerId} ${entry.path} must use HTTPS`);
    }
  }
});

test("browser-based providers expose buildAuthUrl and return provider-specific auth URLs", () => {
  const redirectUri = "http://localhost:43121/callback";
  const state = "state-123";
  const codeChallenge = "challenge-456";

  const claudeUrl = new URL(
    PROVIDERS.claude.buildAuthUrl(CLAUDE_CONFIG, redirectUri, state, codeChallenge)
  );
  const codexUrl = new URL(
    PROVIDERS.codex.buildAuthUrl(CODEX_CONFIG, redirectUri, state, codeChallenge)
  );
  const antigravityUrl = new URL(
    PROVIDERS.antigravity.buildAuthUrl(ANTIGRAVITY_CONFIG, redirectUri, state)
  );
  const clineUrl = new URL(PROVIDERS.cline.buildAuthUrl(CLINE_CONFIG, redirectUri));

  assert.equal(claudeUrl.origin, "https://claude.ai");
  assert.equal(claudeUrl.searchParams.get("client_id"), CLAUDE_CONFIG.clientId);
  assert.equal(codexUrl.origin, "https://auth.openai.com");
  assert.equal(codexUrl.searchParams.get("code_challenge"), codeChallenge);
  assert.equal(antigravityUrl.origin, "https://accounts.google.com");
  assert.equal(clineUrl.origin, "https://api.cline.bot");
});

test("zed-hosted buildAuthUrl returns {authUrl, codeVerifier, redirectUri} carrying a fresh RSA keypair", () => {
  const built = PROVIDERS["zed-hosted"].buildAuthUrl(ZED_HOSTED_CONFIG);
  assert.equal(typeof built, "object");
  assert.ok(built.authUrl.startsWith("https://zed.dev/native_app_signin?"));
  const url = new URL(built.authUrl);
  assert.ok(url.searchParams.get("native_app_public_key"));
  assert.ok(built.codeVerifier.startsWith("zed-rsa-pkcs1:"));
  assert.ok(built.redirectUri.startsWith("http://127.0.0.1:"));
});

test("generateAuthData honors an object-returning buildAuthUrl (zed-hosted) without breaking string-returning providers", async () => {
  const oauthHelpers = await import("../../src/lib/oauth/providers.ts");
  const zedAuthData = oauthHelpers.generateAuthData(
    "zed-hosted",
    "http://localhost:20128/callback"
  );
  assert.equal(zedAuthData.flowType, "authorization_code");
  assert.ok(zedAuthData.authUrl.startsWith("https://zed.dev/native_app_signin?"));
  assert.ok(zedAuthData.codeVerifier.startsWith("zed-rsa-pkcs1:"));
  assert.ok(zedAuthData.redirectUri.startsWith("http://127.0.0.1:"));

  const clineAuthData = oauthHelpers.generateAuthData("cline", "http://localhost:20128/callback");
  assert.equal(typeof clineAuthData.authUrl, "string");
  assert.equal(clineAuthData.redirectUri, "http://localhost:20128/callback");
  assert.ok(clineAuthData.codeVerifier);
  assert.ok(!clineAuthData.codeVerifier.startsWith("zed-rsa-pkcs1:"));
});

test("gitlab-duo buildAuthUrl returns null (not throw) when client_id is unconfigured (#3861)", () => {
  const unconfigured = PROVIDERS["gitlab-duo"].buildAuthUrl(
    { ...GITLAB_DUO_CONFIG, clientId: "" },
    browserUrl,
    "state-x",
    "challenge-y"
  );
  assert.equal(unconfigured, null);

  // Configured: returns a real authorize URL carrying the client_id + PKCE challenge.
  const configured = new URL(
    PROVIDERS["gitlab-duo"].buildAuthUrl(GITLAB_DUO_CONFIG, browserUrl, "state-x", "challenge-y")
  );
  assert.equal(configured.searchParams.get("client_id"), GITLAB_DUO_CONFIG.clientId);
  assert.equal(configured.searchParams.get("code_challenge"), "challenge-y");
});

test("custom Google OAuth credentials switch Antigravity remote callbacks to NEXT_PUBLIC_BASE_URL", () => {
  const redirectUri = resolveBrowserOAuthRedirectUri("antigravity", browserUrl, publicBaseEnv);

  assert.equal(redirectUri, "https://omniroute.example.com/callback");
});

test("custom Google OAuth callbacks preserve the requested callback path and query", () => {
  const redirectUri = resolveBrowserOAuthRedirectUri(
    "antigravity",
    "http://127.0.0.1:20128/auth/callback?source=popup",
    { ...publicBaseEnv, NEXT_PUBLIC_BASE_URL: "https://omniroute.example.com/base" }
  );

  assert.equal(redirectUri, "https://omniroute.example.com/base/auth/callback?source=popup");
});

test("custom Google OAuth credentials switch IPv6 loopback callbacks to public base URL", () => {
  const redirectUri = resolveBrowserOAuthRedirectUri(
    "antigravity",
    "http://[::1]:20128/callback",
    publicBaseEnv
  );

  assert.equal(redirectUri, "https://omniroute.example.com/callback");
});

test("custom Google OAuth callbacks default root loopback paths to callback path", () => {
  const redirectUri = resolveBrowserOAuthRedirectUri(
    "antigravity",
    "http://127.0.0.1:20128",
    publicBaseEnv
  );

  assert.equal(redirectUri, "https://omniroute.example.com/callback");
});

test("Google OAuth callbacks stay on loopback when custom credentials are incomplete", () => {
  const redirectUri = resolveBrowserOAuthRedirectUri(
    "antigravity",
    "http://127.0.0.1:20128/callback",
    {
      NEXT_PUBLIC_BASE_URL: "https://omniroute.example.com",
      ANTIGRAVITY_OAUTH_CLIENT_ID: "custom-antigravity.apps.googleusercontent.com",
    }
  );

  assert.equal(redirectUri, "http://127.0.0.1:20128/callback");
});

test("Google OAuth callbacks stay on localhost when no custom credentials are configured", () => {
  const redirectUri = resolveBrowserOAuthRedirectUri(
    "antigravity",
    "http://localhost:20128/callback",
    {
      NEXT_PUBLIC_BASE_URL: "https://omniroute.example.com",
    }
  );

  assert.equal(redirectUri, "http://localhost:20128/callback");
});

test("device and import-token providers expose the flow-specific fields expected by their configs", () => {
  const deviceProviders = ["kimi-coding", "github", "kiro", "amazon-q", "kilocode"];

  for (const providerId of deviceProviders) {
    const provider = PROVIDERS[providerId];
    assert.equal(provider.flowType, "device_code");
    assert.equal(typeof provider.requestDeviceCode, "function");
    assert.equal(typeof provider.pollToken, "function");
  }

  assert.equal(PROVIDERS.cursor.flowType, "import_token");
  assert.equal(CURSOR_CONFIG.dbKeys.accessToken, "cursorAuth/accessToken");
  assert.equal(CURSOR_CONFIG.dbKeys.machineId, "storage.serviceMachineId");
  assert.equal(PROVIDERS.trae.flowType, "import_token");
  assert.equal(typeof TRAE_CONFIG.apiEndpoint, "string");
  assert.ok(Array.isArray(KIRO_CONFIG.authMethods));
  assert.ok(KIRO_CONFIG.authMethods.includes("builder-id"));
});

test("provider-specific config shapes remain valid for special cases", () => {
  assert.ok(Array.isArray(CLAUDE_CONFIG.scopes) && CLAUDE_CONFIG.scopes.length > 0);
  assert.ok(Array.isArray(ANTIGRAVITY_CONFIG.scopes) && ANTIGRAVITY_CONFIG.scopes.length > 0);
  assert.equal(typeof CODEX_CONFIG.extraParams.originator, "string");
  assert.ok(Array.isArray(KIRO_CONFIG.grantTypes) && KIRO_CONFIG.grantTypes.length > 0);
  assert.equal(typeof KILOCODE_CONFIG.pollUrlBase, "string");
});

test("Antigravity runs mocked browser OAuth exchanges and post-exchange enrichment", async () => {
  useFetchSequence([
    jsonResponse({ access_token: "anti-access", refresh_token: "anti-refresh", expires_in: 7200 }),
    jsonResponse({ email: "anti@example.com" }),
    (_url, init: any = {}) => {
      assert.equal(init.method, "POST");
      assert.equal(init.headers.Authorization, "Bearer anti-access");
      assert.match(
        init.headers["User-Agent"],
        /^antigravity\/2\.1\.1 [^ ]+\/[^ ]+ google-api-nodejs-client\/10\.3\.0$/
      );
      assert.equal(init.headers["X-Goog-Api-Client"], "gl-node/22.21.1");
      assert.deepEqual(
        JSON.parse(String(init.body)).metadata,
        getAntigravityLoadCodeAssistMetadata()
      );
      assert.equal(JSON.parse(String(init.body)).cloudaicompanionProject, undefined);
      return jsonResponse({
        cloudaicompanionProject: { id: "anti-project" },
        allowedTiers: [{ id: "tier-default", isDefault: true }],
      });
    },
    (_url, init: any = {}) => {
      assert.equal(init.method, "POST");
      assert.equal(init.headers.Authorization, "Bearer anti-access");
      assert.match(
        init.headers["User-Agent"],
        /^antigravity\/2\.1\.1 [^ ]+\/[^ ]+ google-api-nodejs-client\/10\.3\.0$/
      );
      assert.equal(init.headers["X-Goog-Api-Client"], "gl-node/22.21.1");
      assert.deepEqual(
        JSON.parse(String(init.body)).metadata,
        getAntigravityLoadCodeAssistMetadata()
      );
      assert.equal(JSON.parse(String(init.body)).tier_id, "tier-default");
      assert.equal(JSON.parse(String(init.body)).cloudaicompanionProject, undefined);
      return jsonResponse({
        done: true,
        response: { cloudaicompanionProject: { id: "anti-project-final" } },
      });
    },
  ]);

  const antigravityTokens = await PROVIDERS.antigravity.exchangeToken(
    ANTIGRAVITY_CONFIG,
    "code-2",
    "http://localhost/callback"
  );
  const antigravityExtra = await PROVIDERS.antigravity.postExchange(antigravityTokens);
  const antigravityMapped = PROVIDERS.antigravity.mapTokens(antigravityTokens, antigravityExtra);
  // postExchange runs onboarding fire-and-forget now (it must never block the OAuth
  // login response); give the background onboard call a tick to consume its mocked
  // fetch so the sequence drains deterministically.
  await new Promise((r) => setTimeout(r, 50));

  assert.equal(antigravityMapped.email, "anti@example.com");
  // projectId comes from loadCodeAssist ("anti-project"), NOT the backgrounded
  // onboardUser response ("anti-project-final"). Onboarding is fire-and-forget, so it
  // no longer updates the returned projectId synchronously — matching the 9router web
  // flow, which also returns the loadCodeAssist project id.
  assert.equal(antigravityMapped.projectId, "anti-project");
  assert.equal(antigravityMapped.providerSpecificData.clientProfile, "ide");
});
