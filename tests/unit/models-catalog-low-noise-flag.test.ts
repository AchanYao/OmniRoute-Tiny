import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-model-catalog-low-noise-"));
process.env.DATA_DIR = TEST_DATA_DIR;
process.env.API_KEY_SECRET = process.env.API_KEY_SECRET || "catalog-low-noise-test-secret";

const core = await import("../../src/lib/db/core.ts");
const providersDb = await import("../../src/lib/db/providers.ts");
const modelsDb = await import("../../src/lib/db/models.ts");
const featureFlagsDb = await import("../../src/lib/db/featureFlags.ts");
const apiKeysDb = await import("../../src/lib/db/apiKeys.ts");
const v1ModelsCatalog = await import("../../src/app/api/v1/models/catalog.ts");

type ModelsResponseBody = {
  data: Array<{ id: string }>;
};

async function resetStorage() {
  core.resetDbInstance();
  apiKeysDb.resetApiKeyState();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

async function seedConnection(provider: string, accessToken: string) {
  return providersDb.createProviderConnection({
    provider,
    authType: "oauth",
    name: `${provider}-low-noise`,
    apiKey: null,
    accessToken,
    isActive: true,
    testStatus: "active",
    providerSpecificData: {},
  });
}

async function getIds(url = "http://localhost/api/v1/models"): Promise<Set<string>> {
  const response = await v1ModelsCatalog.getUnifiedModelsResponse(new Request(url));
  const body = (await response.json()) as ModelsResponseBody;
  return new Set(body.data.map((item) => item.id));
}

test.beforeEach(async () => {
  await resetStorage();
});

test.after(async () => {
  core.resetDbInstance();
  apiKeysDb.resetApiKeyState();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

test("MODELS_CATALOG_PREFIX_MODE=alias suppresses canonical provider-id prefixes", async () => {
  featureFlagsDb.setFeatureFlagOverride("MODELS_CATALOG_PREFIX_MODE", "alias");
  try {
    await seedConnection("cline", "cline-access");
    await modelsDb.addCustomModel("cline", "demo-custom", "Demo Custom");
    const ids = await getIds();
    assert.ok(ids.has("cl/demo-custom"), "alias prefix cl/ should be present");
    assert.equal(ids.has("cline/demo-custom"), false, "canonical prefix cline/ should be absent");
  } finally {
    featureFlagsDb.removeFeatureFlagOverride("MODELS_CATALOG_PREFIX_MODE");
  }
});

test("MODELS_CATALOG_PREFIX_MODE=dual emits both alias and canonical prefixes (default)", async () => {
  featureFlagsDb.setFeatureFlagOverride("MODELS_CATALOG_PREFIX_MODE", "dual");
  try {
    await seedConnection("cline", "cline-access");
    await modelsDb.addCustomModel("cline", "dual-custom", "Dual Custom");
    const ids = await getIds();
    assert.ok(
      ids.has("cl/dual-custom"),
      `alias prefix should be present in dual mode: ${JSON.stringify([...ids].filter((id) => id.includes("dual-custom")))}`
    );
    assert.ok(ids.has("cline/dual-custom"), "canonical prefix should be present in dual mode");
  } finally {
    featureFlagsDb.removeFeatureFlagOverride("MODELS_CATALOG_PREFIX_MODE");
  }
});

test("?prefix=alias query param overrides flag to alias-only mode", async () => {
  featureFlagsDb.setFeatureFlagOverride("MODELS_CATALOG_PREFIX_MODE", "dual");
  try {
    await seedConnection("cline", "cline-access");
    await modelsDb.addCustomModel("cline", "query-alias-custom", "Query Alias Custom");
    const ids = await getIds("http://localhost/api/v1/models?prefix=alias");
    assert.ok(ids.has("cl/query-alias-custom"), "alias prefix present with ?prefix=alias");
    assert.equal(ids.has("cline/query-alias-custom"), false, "canonical prefix absent");
  } finally {
    featureFlagsDb.removeFeatureFlagOverride("MODELS_CATALOG_PREFIX_MODE");
  }
});

test("?prefix=canonical query param overrides flag to canonical-only mode", async () => {
  featureFlagsDb.setFeatureFlagOverride("MODELS_CATALOG_PREFIX_MODE", "dual");
  try {
    await seedConnection("cline", "cline-access");
    await modelsDb.addCustomModel("cline", "query-canonical-custom", "Query Canonical Custom");
    const ids = await getIds("http://localhost/api/v1/models?prefix=canonical");
    assert.equal(ids.has("cl/query-canonical-custom"), false, "alias prefix absent");
    assert.ok(ids.has("cline/query-canonical-custom"), "canonical prefix present");
  } finally {
    featureFlagsDb.removeFeatureFlagOverride("MODELS_CATALOG_PREFIX_MODE");
  }
});
