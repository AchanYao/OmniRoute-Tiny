/**
 * #7694 — capture upstream `reasoning.supported_efforts` at sync, surface it as
 * `capabilities.effort_tiers` in the catalog, and support `<prefix>/<model>-{effort}`
 * request-time alias resolution.
 *
 * Mirrors the #6879 per-model reasoning-effort precedent
 * (open-sse/services/defaultReasoningEffort.ts): captures/exposes what the provider
 * already declared and threads it through the EXISTING `supportedThinkingEfforts`
 * plumbing (`SyncedAvailableModel`, `src/sse/services/model.ts` `RuntimeModelMeta`) —
 * no parallel storage mechanism.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-7694-effort-sync-"));
process.env.DATA_DIR = TEST_DATA_DIR;
process.env.API_KEY_SECRET = process.env.API_KEY_SECRET || "catalog-test-secret-7694";

const core = await import("../../src/lib/db/core.ts");
const providersDb = await import("../../src/lib/db/providers.ts");
const modelsDb = await import("../../src/lib/db/models.ts");
const v1ModelsCatalog = await import("../../src/app/api/v1/models/catalog.ts");
const { getModelInfo } = await import("../../src/sse/services/model.ts");
const { normalizeDiscoveredModels, detectSupportedThinkingEfforts } =
  await import("../../src/lib/providerModels/modelDiscovery.ts");
const { applyDefaultReasoningEffort } =
  await import("../../open-sse/services/defaultReasoningEffort.ts");

async function resetStorage() {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

test.beforeEach(async () => {
  v1ModelsCatalog.__resetCatalogBuilderRunsForTest();
  await resetStorage();
});

test.after(() => {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

async function seedProviderConnection(provider: string) {
  return providersDb.createProviderConnection({
    provider,
    authType: "apikey",
    name: `${provider}-${Math.random().toString(16).slice(2, 8)}`,
    apiKey: `${provider}-key`,
    isActive: true,
    testStatus: "active",
  });
}

// ---------------------------------------------------------------------------
// Step 1+2: sync-time capture of the nested `reasoning.supported_efforts` shape,
// normalized onto the canonical vocabulary. Hard Rule #7 — Zod-validated.
// ---------------------------------------------------------------------------

test("normalizeDiscoveredModels: captures nested reasoning.supported_efforts (no flat field) and normalizes 'max' -> 'xhigh'", () => {
  const [model] = normalizeDiscoveredModels([
    {
      id: "some/model-7694",
      reasoning: { supported_efforts: ["low", "medium", "max"] },
    },
  ]);
  assert.deepEqual(model.supportedThinkingEfforts, ["low", "medium", "xhigh"]);
});

test("normalizeDiscoveredModels: pre-existing flat supportedThinkingEfforts field wins verbatim over nested (regression)", () => {
  const [model] = normalizeDiscoveredModels([
    {
      id: "some/model-flat",
      supportedThinkingEfforts: ["low", "max"], // byte-identical pass-through, no normalization
      reasoning: { supported_efforts: ["high"] }, // must be ignored — flat field wins
    },
  ]);
  assert.deepEqual(model.supportedThinkingEfforts, ["low", "max"]);
});

test("normalizeDiscoveredModels: an unrecognized provider-native tier passes through unchanged (e.g. codex-style 'ultra')", () => {
  const [model] = normalizeDiscoveredModels([
    { id: "some/model-ultra", reasoning: { supported_efforts: ["ultra"] } },
  ]);
  assert.deepEqual(model.supportedThinkingEfforts, ["ultra"]);
});

test("normalizeDiscoveredModels: graceful degradation — reasoning:{} (no supported_efforts key) produces no supportedThinkingEfforts field, does not throw", () => {
  const [model] = normalizeDiscoveredModels([{ id: "some/model-empty-reasoning", reasoning: {} }]);
  assert.equal("supportedThinkingEfforts" in model, false);
});

test("normalizeDiscoveredModels: graceful degradation — reasoning entirely absent produces no supportedThinkingEfforts field, does not throw", () => {
  const [model] = normalizeDiscoveredModels([{ id: "some/model-no-reasoning" }]);
  assert.equal("supportedThinkingEfforts" in model, false);
});

test("detectSupportedThinkingEfforts: Hard Rule #7 — malformed upstream payload (supported_efforts is a string, not an array) is rejected by Zod and degrades to undefined without throwing", () => {
  assert.doesNotThrow(() => {
    const result = detectSupportedThinkingEfforts({
      reasoning: { supported_efforts: "high" as unknown },
    });
    assert.equal(result, undefined);
  });
});

test("detectSupportedThinkingEfforts: malformed upstream payload (reasoning is a string, not an object) is rejected by Zod and degrades to undefined without throwing", () => {
  assert.doesNotThrow(() => {
    const result = detectSupportedThinkingEfforts({ reasoning: "not-an-object" as unknown });
    assert.equal(result, undefined);
  });
});

// ---------------------------------------------------------------------------
// Step 3: catalog surfaces capabilities.effort_tiers for synced models.
// ---------------------------------------------------------------------------

test("#7694 catalog: GET /api/v1/models surfaces capabilities.effort_tiers for a synced model with nested reasoning.supported_efforts", async () => {
  const connection = await seedProviderConnection("huggingface");

  await modelsDb.replaceSyncedAvailableModelsForConnection("huggingface", connection.id, [
    {
      id: "some-org/reasoning-model-7694",
      name: "Reasoning Model 7694",
      supportedThinkingEfforts: ["low", "medium", "high"],
    },
  ]);

  const response = await v1ModelsCatalog.getUnifiedModelsResponse(
    new Request("http://localhost/api/v1/models")
  );
  assert.equal(response.status, 200);

  const body = (await response.json()) as {
    data: Array<{ id: string; capabilities?: { effort_tiers?: string[] } }>;
  };
  const entry = body.data.find((m) => m.id.endsWith("some-org/reasoning-model-7694"));
  assert.ok(entry, "synced reasoning model must appear in the catalog");
  assert.deepEqual(entry!.capabilities?.effort_tiers, ["low", "medium", "high"]);
});

test("#7694 catalog: a synced model with no supportedThinkingEfforts gets no capabilities.effort_tiers (graceful degradation)", async () => {
  const connection = await seedProviderConnection("huggingface");

  await modelsDb.replaceSyncedAvailableModelsForConnection("huggingface", connection.id, [
    { id: "some-org/no-reasoning-model-7694", name: "No Reasoning Model 7694" },
  ]);

  const response = await v1ModelsCatalog.getUnifiedModelsResponse(
    new Request("http://localhost/api/v1/models")
  );
  const body = (await response.json()) as {
    data: Array<{ id: string; capabilities?: { effort_tiers?: string[] } }>;
  };
  const entry = body.data.find((m) => m.id.endsWith("some-org/no-reasoning-model-7694"));
  assert.ok(entry);
  assert.equal(entry!.capabilities?.effort_tiers, undefined);
});

// ---------------------------------------------------------------------------
// Step 4: catalog keeps effort tiers as metadata without generating model ids.
// ---------------------------------------------------------------------------

test("#7694 catalog: GET /api/v1/models does not advertise synthetic effort aliases", async () => {
  const connection = await seedProviderConnection("huggingface");

  await modelsDb.replaceSyncedAvailableModelsForConnection("huggingface", connection.id, [
    {
      id: "some-org/reasoning-model-alias-7694",
      name: "Reasoning Model Alias 7694",
      supportedThinkingEfforts: ["low", "high"],
    },
  ]);

  const response = await v1ModelsCatalog.getUnifiedModelsResponse(
    new Request("http://localhost/api/v1/models")
  );
  const body = (await response.json()) as { data: Array<{ id: string }> };
  const baseEntry = body.data.find((m) => m.id.endsWith("some-org/reasoning-model-alias-7694"));
  assert.ok(baseEntry, "base model must appear in the catalog");

  const highVariant = body.data.find((m) => m.id === `${baseEntry!.id}-high`);
  const lowVariant = body.data.find((m) => m.id === `${baseEntry!.id}-low`);
  assert.equal(highVariant, undefined);
  assert.equal(lowVariant, undefined);
});

// ---------------------------------------------------------------------------
// Step 5: request-time suffixes remain literal model ids.
// ---------------------------------------------------------------------------

const EFFORT_CONN_ID = "openai-compatible-chat-7694-effort-probe";
const EFFORT_PREFIX = "pfx7694";
const EFFORT_BASE_MODEL = "reasoning-model-7694";

async function seedEffortSuffixNode() {
  await providersDb.createProviderNode({
    id: EFFORT_CONN_ID,
    type: "openai-compatible",
    name: "7694 effort-suffix probe",
    prefix: EFFORT_PREFIX,
    baseUrl: "https://proxy.example.com",
    chatPath: "/v1/chat/completions",
    modelsPath: "/v1/models",
  });
  await modelsDb.replaceSyncedAvailableModelsForConnection(EFFORT_CONN_ID, EFFORT_CONN_ID, [
    {
      id: EFFORT_BASE_MODEL,
      name: "Reasoning Model 7694",
      supportedThinkingEfforts: ["low", "medium", "high"],
    },
  ]);
}

test("#7694: <prefix>/<model>-high remains a literal model id", async () => {
  await seedEffortSuffixNode();

  const info = (await getModelInfo(`${EFFORT_PREFIX}/${EFFORT_BASE_MODEL}-high`)) as {
    provider?: string;
    model?: string;
  };
  assert.equal(info.provider, EFFORT_CONN_ID);
  assert.equal(info.model, `${EFFORT_BASE_MODEL}-high`);
});

test("#7694: an unsupported effort suffix is NOT stripped (treated as a literal/unknown model id — collision-risk guard holds)", async () => {
  await seedEffortSuffixNode();

  const info = (await getModelInfo(`${EFFORT_PREFIX}/${EFFORT_BASE_MODEL}-ultrahigh`)) as {
    provider?: string;
    model?: string;
  };
  assert.equal(info.provider, EFFORT_CONN_ID);
  assert.equal(
    info.model,
    `${EFFORT_BASE_MODEL}-ultrahigh`,
    "unknown suffix must pass through literally, not be silently stripped"
  );
});

test("#7694: the base model id (no suffix) still resolves normally and carries its full tier list", async () => {
  await seedEffortSuffixNode();

  const info = (await getModelInfo(`${EFFORT_PREFIX}/${EFFORT_BASE_MODEL}`)) as {
    provider?: string;
    model?: string;
    supportedThinkingEfforts?: string[];
  };
  assert.equal(info.provider, EFFORT_CONN_ID);
  assert.equal(info.model, EFFORT_BASE_MODEL);
  assert.deepEqual(info.supportedThinkingEfforts, ["low", "medium", "high"]);
});

// ---------------------------------------------------------------------------
// applyDefaultReasoningEffort retains the per-model default behavior from #6879.
// ---------------------------------------------------------------------------

test("applyDefaultReasoningEffort: no suffix effort and no ModelSpec default -> no injection (regression, same reference)", () => {
  const body = { model: "some-model-untouched", messages: [] };
  const result = applyDefaultReasoningEffort(body, "some-model-untouched", null);
  assert.equal(result, body);
});
