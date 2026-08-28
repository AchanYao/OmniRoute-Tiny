import assert from "node:assert/strict";
import test from "node:test";

import {
  generateProviderPluginManifestFromRegistry,
  getProviderPluginManifestEntryFromRegistry,
} from "../../open-sse/config/providerPluginManifest.ts";
import type { RegistryEntry } from "../../open-sse/config/providers/shared.ts";

const registryFixture: Record<string, RegistryEntry> = {
  openai: {
    id: "openai",
    alias: "openai",
    format: "openai",
    executor: "default",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    authType: "apikey",
    authHeader: "bearer",
    defaultContextLength: 128000,
    models: [
      { id: "gpt-4.1", name: "GPT-4.1", contextLength: 1047576 },
      {
        id: "o3",
        name: "O3",
        contextLength: 200000,
        unsupportedParams: ["temperature", "top_p"],
      },
    ],
  },
  anthropic: {
    id: "anthropic",
    alias: "anthropic",
    format: "claude",
    executor: "default",
    baseUrl: "https://api.anthropic.com/v1/messages",
    authType: "apikey",
    authHeader: "x-api-key",
    headers: {
      "Anthropic-Version": "2023-06-01",
    },
    models: [{ id: "claude-sonnet-4.6", name: "Claude Sonnet 4.6" }],
  },
  gitlab: {
    id: "gitlab",
    alias: "gl",
    format: "openai",
    executor: "gitlab",
    baseUrl: "https://gitlab.com/api/v4/chat/completions",
    authType: "apikey",
    authHeader: "bearer",
    models: [{ id: "claude-sonnet-4.6", name: "Claude Sonnet 4.6 (GitLab Duo)" }],
  },
  claude: {
    id: "claude",
    alias: "claude",
    format: "claude",
    executor: "default",
    baseUrl: "https://api.anthropic.com/v1/messages",
    authType: "oauth",
    authHeader: "x-api-key",
    oauth: {
      clientIdDefault: "public-client",
      clientSecretDefault: "secret-that-must-not-export",
      tokenUrl: "https://console.anthropic.com/oauth/token",
    },
    models: [{ id: "claude-opus-4.7", name: "Claude Opus 4.7" }],
  },
};

test("provider plugin manifest is JSON-safe and stable enough for sidecars", () => {
  const manifest = generateProviderPluginManifestFromRegistry(registryFixture);
  const roundTripped = JSON.parse(JSON.stringify(manifest));

  assert.equal(roundTripped.schemaVersion, 1);
  assert.equal(roundTripped.generatedFrom, "open-sse/config/providers");
  assert.equal(roundTripped.providers.length, 4);
  assert.deepEqual(
    roundTripped.providers.map((provider: { id: string }) => provider.id),
    [...roundTripped.providers.map((provider: { id: string }) => provider.id)].sort()
  );
});

test("manifest exposes API-key default-executor providers as sidecar candidates", () => {
  const openai = getProviderPluginManifestEntryFromRegistry(registryFixture, "openai");

  assert.ok(openai);
  assert.equal(openai.sidecar.eligible, true);
  assert.deepEqual(openai.sidecar.reasons, []);
  assert.ok(openai.capabilities.includes("apikey"));
  assert.ok(openai.capabilities.includes("sidecar-candidate"));
  assert.equal(openai.endpoints.baseUrl, "https://api.openai.com/v1/chat/completions");
  assert.ok(openai.models.some((model) => model.id === "gpt-4.1"));
});

test("manifest keeps custom executors on the TypeScript fallback path", () => {
  const gitlab = getProviderPluginManifestEntryFromRegistry(registryFixture, "gl");

  assert.ok(gitlab);
  assert.equal(gitlab.id, "gitlab");
  assert.equal(gitlab.sidecar.eligible, false);
  assert.ok(gitlab.capabilities.includes("custom-executor"));
  assert.ok(gitlab.sidecar.reasons.some((reason) => reason.includes("gitlab")));
});

test("manifest does not export OAuth client secrets or dynamic functions", () => {
  const manifest = generateProviderPluginManifestFromRegistry(registryFixture);
  const serialized = JSON.stringify(manifest);

  assert.equal(serialized.includes("clientSecret"), false);
  assert.equal(serialized.includes("clientSecretDefault"), false);
  assert.equal(serialized.includes("clientSecretEnv"), false);

  const parsed = JSON.parse(serialized);
  for (const provider of parsed.providers) {
    assert.notEqual(typeof provider.endpoints?.urlBuilder, "function");
    assert.equal("oauth" in provider, false);
    assert.equal("headers" in provider, false);
    assert.equal("extraHeaders" in provider, false);
    assert.equal("requestDefaults" in provider, false);
  }
});
