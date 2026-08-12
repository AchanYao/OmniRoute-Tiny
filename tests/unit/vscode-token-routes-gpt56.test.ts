import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(
  path.join(os.tmpdir(), "omniroute-vscode-token-routes-gpt56-")
);
process.env.DATA_DIR = TEST_DATA_DIR;
process.env.API_KEY_SECRET = process.env.API_KEY_SECRET || "vscode-token-routes-gpt56-secret";

const core = await import("../../src/lib/db/core.ts");
const providersDb = await import("../../src/lib/db/providers.ts");
const settingsDb = await import("../../src/lib/db/settings.ts");
const apiKeysDb = await import("../../src/lib/db/apiKeys.ts");
const vscodeRawModelsRoute =
  await import("../../src/app/api/v1/vscode/raw/[token]/models/route.ts");
const { expandVscodeRawModels } =
  await import("../../src/app/api/v1/vscode/[token]/models/route.ts");

interface RawModel {
  id: string;
  [key: string]: unknown;
}

async function resetStorage() {
  core.resetDbInstance();
  apiKeysDb.resetApiKeyState();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

test.beforeEach(async () => {
  await resetStorage();
});

test.after(() => {
  core.resetDbInstance();
  apiKeysDb.resetApiKeyState();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

test("vscode models route keeps gateway-owned Ollama Cloud models", async () => {
  await settingsDb.updateSettings({
    requireLogin: true,
    password: "hashed-password",
    requireAuthForModels: true,
  });
  await providersDb.createProviderConnection({
    provider: "ollama-cloud",
    authType: "apikey",
    name: "ollama-cloud-vscode-efforts",
    apiKey: "ollama-test-key",
    isActive: true,
    testStatus: "active",
    providerSpecificData: {},
  });
  const key = await apiKeysDb.createApiKey(
    "vscode-ollama-cloud-efforts",
    "machine-vscode-ollama-cloud-efforts"
  );
  const vscodeModelsRoute = await import("../../src/app/api/v1/vscode/[token]/models/route.ts");

  const response = await vscodeModelsRoute.GET(
    new Request(`http://localhost/api/v1/vscode/${encodeURIComponent(key.key)}/models`)
  );
  const body = (await response.json()) as {
    data?: Array<{
      id?: string;
      root?: string;
      supportsReasoningEffort?: string[];
      supportedReasoningEfforts?: string[];
      defaultReasoningEffort?: string;
      capabilities?: { effort_tiers?: string[] };
      owned_by?: string;
      providers?: string[];
    }>;
  };
  const model = (body.data || []).find(
    (entry) => entry.root === "gpt-oss:20b" || entry.id === "ollamacloud/gpt-oss:20b"
  );

  assert.equal(response.status, 200);
  assert.ok(model, "missing Ollama Cloud GPT-OSS model");
  assert.equal(model.owned_by, "ollama-cloud");
  assert.deepEqual(model.capabilities?.effort_tiers, ["low", "medium", "high"]);
  assert.deepEqual(model.supportsReasoningEffort, ["low", "medium", "high"]);
  assert.deepEqual(model.supportedReasoningEfforts, ["low", "medium", "high"]);
  assert.equal(model.defaultReasoningEffort, "low");
});

test("vscode raw models route exposes GPT-5.6 base IDs with effort metadata", async () => {
  await settingsDb.updateSettings({
    requireLogin: true,
    password: "hashed-password",
    requireAuthForModels: true,
  });
  await providersDb.createProviderConnection({
    provider: "codex",
    authType: "oauth",
    name: "codex-vscode-raw-models",
    accessToken: "codex-test-token",
    isActive: true,
    testStatus: "active",
    providerSpecificData: {},
  });
  const key = await apiKeysDb.createApiKey(
    "vscode-raw-models-codex",
    "machine-vscode-raw-models-codex"
  );

  const response = await vscodeRawModelsRoute.GET(
    new Request(`http://localhost/api/v1/vscode/raw/${encodeURIComponent(key.key)}/models`)
  );
  const body = (await response.json()) as { data?: RawModel[] };
  const models = body.data ?? [];
  const importedIds = new Set(models.map((entry) => entry.id));
  const findModel = (id: string) => models.find((entry) => entry.id === id);
  const defaultModel = findModel("codex/gpt-5.6-sol");
  const fastModel = findModel("codex/gpt-5.6-sol__tier_priority");
  const flexModel = findModel("codex/gpt-5.6-sol__tier_flex");

  assert.equal(response.status, 200);
  assert.ok(defaultModel, "missing codex/gpt-5.6-sol in raw VS Code models route");
  assert.ok(fastModel, "missing codex/gpt-5.6-sol__tier_priority in raw VS Code models route");
  assert.ok(flexModel, "missing codex/gpt-5.6-sol__tier_flex in raw VS Code models route");
  assert.equal(importedIds.size, models.length, "raw VS Code models route must not duplicate ids");
  assert.ok(!importedIds.has("gpt-5.6-sol__provider_codex"));
  assert.ok(!importedIds.has("gpt-5.6-sol__provider_codex__tier_priority"));
  assert.ok(!importedIds.has("gpt-5.6-sol__provider_codex__tier_flex"));
  assert.equal(defaultModel.object, "model");
  assert.equal(typeof defaultModel.created, "number");
  assert.equal(defaultModel.owned_by, "codex");
  assert.equal(defaultModel.name, "Codex GPT 5.6 Sol");
  assert.equal(defaultModel.context_length, 1050000);
  assert.equal(defaultModel.max_output_tokens, 128000);
  assert.equal(defaultModel.max_input_tokens, 922000);
  assert.deepEqual(defaultModel.capabilities, {
    vision: true,
    tool_calling: true,
    reasoning: true,
    thinking: true,
    supportsThinking: true,
    effort_tiers: ["low", "medium", "high", "xhigh", "max", "ultra"],
  });
  for (const field of [
    "url",
    "toolCalling",
    "vision",
    "family",
    "supportsReasoningEffort",
    "supportedReasoningEfforts",
    "defaultReasoningEffort",
    "configurationSchema",
    "configSchema",
    "maxInputTokens",
  ]) {
    assert.equal(defaultModel[field], undefined);
  }

  const lowModel = findModel("codex/gpt-5.6-sol-low");
  const mediumModel = findModel("codex/gpt-5.6-sol-medium");
  const highModel = findModel("codex/gpt-5.6-sol-high");
  const lowFastModel = findModel("codex/gpt-5.6-sol-low__tier_priority");
  const mediumFastModel = findModel("codex/gpt-5.6-sol-medium__tier_priority");
  const highFastModel = findModel("codex/gpt-5.6-sol-high__tier_priority");

  assert.equal(lowModel, undefined);
  assert.equal(mediumModel, undefined);
  assert.equal(highModel, undefined);
  assert.equal(lowFastModel, undefined);
  assert.equal(mediumFastModel, undefined);
  assert.equal(highFastModel, undefined);
});
