import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(
  path.join(os.tmpdir(), "omniroute-provider-model-management-route-")
);
process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../src/lib/db/core.ts");
const modelsDb = await import("../../src/lib/db/models.ts");
const providerModelsRoute = await import("../../src/app/api/provider-models/route.ts");

async function resetStorage() {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

function buildPatchRequest(url, body) {
  return new Request(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function buildGetRequest(url = "http://localhost/api/provider-models") {
  return new Request(url, { method: "GET" });
}

function buildDeleteRequest(url) {
  return new Request(url, { method: "DELETE" });
}

type ProviderModelsResponse = {
  models?: Record<string, Array<{ id: string; isHidden?: boolean }>> | Array<{ id: string }>;
  modelCompatOverrides?: Array<{ id: string; isHidden?: boolean }>;
  hiddenModelsByProvider?: Record<string, string[]>;
};

async function getBody(response: Response): Promise<ProviderModelsResponse> {
  return (await response.json()) as ProviderModelsResponse;
}

test.beforeEach(async () => {
  await resetStorage();
});

test.after(async () => {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

test("provider-models GET returns an empty hiddenModelsByProvider map with no hidden models", async () => {
  const response = await providerModelsRoute.GET(buildGetRequest());
  const body = await getBody(response);

  assert.equal(response.status, 200);
  assert.deepEqual(body.hiddenModelsByProvider, {});
  assert.ok(typeof body.models === "object" && body.models !== null);
  assert.ok(Array.isArray(body.modelCompatOverrides));
});

test("provider-models GET surfaces hidden custom and catalog-override models per provider", async () => {
  // Hidden custom model (customModels namespace).
  await modelsDb.addCustomModel(
    "openai",
    "gpt-hidden",
    "GPT Hidden",
    "manual",
    "chat-completions",
    ["chat"]
  );
  await providerModelsRoute.PATCH(
    buildPatchRequest("http://localhost/api/provider-models?provider=openai&modelId=gpt-hidden", {
      isHidden: true,
    })
  );
  // Hidden catalog override (modelCompatOverrides namespace) + a visible sibling.
  await providerModelsRoute.PATCH(
    buildPatchRequest(
      "http://localhost/api/provider-models?provider=claude&modelId=claude-sonnet-4-6",
      { isHidden: true }
    )
  );
  await modelsDb.addCustomModel("claude", "claude-visible", "Claude Visible", "manual", "chat", [
    "chat",
  ]);

  const response = await providerModelsRoute.GET(buildGetRequest());
  const body = await getBody(response);

  assert.equal(response.status, 200);
  // `models` is keyed by provider (getAllCustomModels shape) — assert the hidden
  // custom row landed under its provider, and that the hidden map only carries
  // hidden ids (custom + catalog-override), never the visible sibling.
  const modelsByProvider = body.models as Record<string, Array<{ id: string }>>;
  assert.ok(Array.isArray(modelsByProvider.openai));
  assert.ok(modelsByProvider.openai.some((model) => model.id === "gpt-hidden"));
  assert.deepEqual(body.hiddenModelsByProvider, {
    openai: ["gpt-hidden"],
    claude: ["claude-sonnet-4-6"],
  });
  assert.equal(body.hiddenModelsByProvider!.claude.includes("claude-visible"), false);
});

test("provider-models GET keeps the original models and modelCompatOverrides contract", async () => {
  await modelsDb.addCustomModel("openai", "gpt-test", "GPT Test", "manual", "chat-completions", [
    "chat",
  ]);
  await providerModelsRoute.PATCH(
    buildPatchRequest(
      "http://localhost/api/provider-models?provider=claude&modelId=claude-sonnet-4-6",
      { isHidden: true }
    )
  );

  // Per-provider GET keeps the array-shaped models + modelCompatOverrides contract
  // while still returning the global hidden map (#9203).
  const response = await providerModelsRoute.GET(
    buildGetRequest("http://localhost/api/provider-models?provider=claude")
  );
  const body = await getBody(response);

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(body.models));
  assert.ok(Array.isArray(body.modelCompatOverrides));
  assert.ok(
    body.modelCompatOverrides!.some(
      (override) => override.id === "claude-sonnet-4-6" && override.isHidden
    )
  );
  assert.deepEqual(body.hiddenModelsByProvider, {
    claude: ["claude-sonnet-4-6"],
  });
});

test("provider-models PATCH updates hidden flag for custom models", async () => {
  await modelsDb.addCustomModel("openai", "gpt-test", "GPT Test", "manual", "chat-completions", [
    "chat",
  ]);

  const response = await providerModelsRoute.PATCH(
    buildPatchRequest("http://localhost/api/provider-models?provider=openai&modelId=gpt-test", {
      isHidden: true,
    })
  );
  const body = (await response.json()) as { ok?: boolean };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);

  const models = await modelsDb.getCustomModels("openai");
  assert.equal(models.find((model) => model.id === "gpt-test")?.isHidden, true);
});

test("provider-models PATCH persists visibility overrides for catalog models", async () => {
  const response = await providerModelsRoute.PATCH(
    buildPatchRequest(
      "http://localhost/api/provider-models?provider=claude&modelId=claude-sonnet-4-6",
      { isHidden: true }
    )
  );
  const body = (await response.json()) as { ok?: boolean };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);

  const overrides = modelsDb.getModelCompatOverrides("claude");
  assert.equal(overrides.find((model) => model.id === "claude-sonnet-4-6")?.isHidden, true);
});

test("provider-models PATCH hides auto-imported models via compat overrides", async () => {
  // Cursor OAuth auto-import (and other live discovery) persists models as
  // customModels rows with source=imported. GET /api/provider-models filters
  // those rows out, so hiding must land on modelCompatOverrides — the store
  // the dashboard refresh and /v1/models catalog actually read.
  await modelsDb.addCustomModel(
    "cursor-oauth",
    "composer-1.5",
    "Composer 1.5",
    "imported",
    "chat-completions",
    ["chat"]
  );

  const response = await providerModelsRoute.PATCH(
    buildPatchRequest(
      "http://localhost/api/provider-models?provider=cursor-oauth&modelId=composer-1.5",
      { isHidden: true }
    )
  );
  const body = (await response.json()) as { ok?: boolean };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);

  const listed = await modelsDb.getCustomModels("cursor-oauth");
  assert.equal(
    listed.find((model) => model.id === "composer-1.5"),
    undefined,
    "imported rows stay filtered out of getCustomModels"
  );

  const overrides = modelsDb.getModelCompatOverrides("cursor-oauth");
  assert.equal(
    overrides.find((model) => model.id === "composer-1.5")?.isHidden,
    true,
    "eye-hide of an imported model must persist on modelCompatOverrides"
  );
  assert.equal(modelsDb.getModelIsHidden("cursor-oauth", "composer-1.5"), true);

  const getResponse = await providerModelsRoute.GET(
    buildGetRequest("http://localhost/api/provider-models?provider=cursor-oauth")
  );
  const listedBody = await getBody(getResponse);
  assert.ok(
    listedBody.modelCompatOverrides!.some(
      (override) => override.id === "composer-1.5" && override.isHidden
    )
  );
  assert.deepEqual(listedBody.hiddenModelsByProvider, {
    "cursor-oauth": ["composer-1.5"],
  });
});

test("provider-models falls back to legacy custom model isHidden until overridden", async () => {
  await modelsDb.addCustomModel("cursor-oauth", "legacy-imported", "Legacy Imported", "imported");
  const db = core.getDbInstance();
  db.prepare(
    "UPDATE key_value SET value = ? WHERE namespace = 'customModels' AND key = 'cursor-oauth'"
  ).run(
    JSON.stringify([
      { id: "legacy-imported", name: "Legacy Imported", source: "imported", isHidden: true },
    ])
  );

  const getResponse = await providerModelsRoute.GET(
    buildGetRequest("http://localhost/api/provider-models?provider=cursor-oauth")
  );
  const body = await getBody(getResponse);
  assert.deepEqual(body.hiddenModelsByProvider, {
    "cursor-oauth": ["legacy-imported"],
  });

  // Explicitly unhide — override layer must win over legacy imported value
  const patchResponse = await providerModelsRoute.PATCH(
    buildPatchRequest(
      "http://localhost/api/provider-models?provider=cursor-oauth&modelId=legacy-imported",
      { isHidden: false }
    )
  );
  assert.strictEqual(patchResponse.status, 200);

  const getResponseAfter = await providerModelsRoute.GET(
    buildGetRequest("http://localhost/api/provider-models?provider=cursor-oauth")
  );
  const bodyAfter = await getBody(getResponseAfter);
  assert.deepEqual(bodyAfter.hiddenModelsByProvider, {});
});
test("provider-models PATCH supports bulk visibility updates", async () => {
  await providerModelsRoute.PATCH(
    buildPatchRequest("http://localhost/api/provider-models?provider=claude", {
      isHidden: true,
      modelIds: ["claude-opus-4-6", "claude-sonnet-4-6"],
    })
  );

  const response = await providerModelsRoute.PATCH(
    buildPatchRequest("http://localhost/api/provider-models?provider=claude", {
      isHidden: false,
      modelIds: ["claude-opus-4-6", "claude-sonnet-4-6"],
    })
  );
  const body = (await response.json()) as { updated?: number };

  assert.equal(response.status, 200);
  assert.equal(body.updated, 2);

  const overrides = modelsDb.getModelCompatOverrides("claude");
  assert.equal(overrides.find((model) => model.id === "claude-opus-4-6")?.isHidden, false);
  assert.equal(overrides.find((model) => model.id === "claude-sonnet-4-6")?.isHidden, false);
});

test("provider-models visibility changes preserve manual model aliases", async () => {
  await modelsDb.setModelAlias("manual-claude", "claude/claude-sonnet-4-6");

  const hidden = await providerModelsRoute.PATCH(
    buildPatchRequest(
      "http://localhost/api/provider-models?provider=claude&modelId=claude-sonnet-4-6",
      { isHidden: true }
    )
  );
  const visible = await providerModelsRoute.PATCH(
    buildPatchRequest(
      "http://localhost/api/provider-models?provider=claude&modelId=claude-sonnet-4-6",
      { isHidden: false }
    )
  );

  assert.equal(hidden.status, 200);
  assert.equal(visible.status, 200);
  assert.equal((await modelsDb.getModelAliases())["manual-claude"], "claude/claude-sonnet-4-6");
});

test("provider-models deletion preserves manual model aliases", async () => {
  await modelsDb.addCustomModel("openai", "gpt-test", "GPT Test", "manual");
  await modelsDb.setModelAlias("manual-gpt", "openai/gpt-test");

  const removed = await providerModelsRoute.DELETE(
    buildDeleteRequest("http://localhost/api/provider-models?provider=openai&model=gpt-test")
  );

  assert.equal(removed.status, 200);
  assert.equal((await modelsDb.getModelAliases())["manual-gpt"], "openai/gpt-test");
});

test("provider-models provider clear preserves manual model aliases", async () => {
  await modelsDb.addCustomModel("openai", "gpt-test", "GPT Test", "manual");
  await modelsDb.setModelAlias("manual-gpt", "openai/gpt-test");

  const cleared = await providerModelsRoute.DELETE(
    buildDeleteRequest("http://localhost/api/provider-models?provider=openai&all=true")
  );

  assert.equal(cleared.status, 200);
  assert.equal((await modelsDb.getModelAliases())["manual-gpt"], "openai/gpt-test");
});

test("provider-models PATCH validates required fields", async () => {
  const response = await providerModelsRoute.PATCH(
    buildPatchRequest("http://localhost/api/provider-models?provider=claude", {
      modelIds: ["claude-sonnet-4-6"],
    })
  );
  const body = (await response.json()) as { error?: { message?: string } };

  assert.equal(response.status, 400);
  assert.equal(body.error.message, "isHidden boolean is required");
});
