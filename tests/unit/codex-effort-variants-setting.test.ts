import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const previousSetting = process.env.MODEL_EFFORT_VARIANTS_ENABLED;
const previousDataDir = process.env.DATA_DIR;
const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-codex-effort-setting-"));
process.env.DATA_DIR = testDataDir;
process.env.API_KEY_SECRET ||= "codex-effort-setting-test-secret";
delete process.env.MODEL_EFFORT_VARIANTS_ENABLED;

const { getCodexRegistryModels } =
  await import("../../open-sse/config/providers/registry/codex/index.ts");
const { isEffortVariantsEnabled } = await import("../../open-sse/config/effortVariants.ts");
const { resolveModelOrError } = await import("../../src/sse/handlers/chatHelpers.ts");
const providersDb = await import("../../src/lib/db/providers.ts");
const catalog = await import("../../src/app/api/v1/models/catalog.ts");

test.after(async () => {
  const core = await import("../../src/lib/db/core.ts");
  core.resetDbInstance();
  fs.rmSync(testDataDir, { recursive: true, force: true });
  if (previousSetting === undefined) {
    delete process.env.MODEL_EFFORT_VARIANTS_ENABLED;
  } else {
    process.env.MODEL_EFFORT_VARIANTS_ENABLED = previousSetting;
  }
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
});

test("Codex effort variants are disabled by default", () => {
  assert.equal(isEffortVariantsEnabled(), false);

  const ids = getCodexRegistryModels(false).map((model) => model.id);
  assert.ok(ids.includes("gpt-5.6-sol"));
  assert.ok(ids.includes("gpt-5.5"));
  assert.equal(
    ids.some((id) => /-(?:low|medium|high|xhigh|max|ultra)$/.test(id)),
    false
  );
});

test("Codex effort variants can be registered explicitly", () => {
  const ids = getCodexRegistryModels(true).map((model) => model.id);
  assert.ok(ids.includes("gpt-5.6-sol-low"));
  assert.ok(ids.includes("gpt-5.6-sol-ultra"));
  assert.ok(ids.includes("gpt-5.5-xhigh"));
});

test("MODEL_EFFORT_VARIANTS_ENABLED uses explicit boolean semantics", () => {
  for (const value of ["true", "1", "yes"]) {
    process.env.MODEL_EFFORT_VARIANTS_ENABLED = value;
    assert.equal(isEffortVariantsEnabled(), true, value);
  }
  for (const value of ["false", "0", "no", "unexpected", ""]) {
    process.env.MODEL_EFFORT_VARIANTS_ENABLED = value;
    assert.equal(isEffortVariantsEnabled(), false, value);
  }
});

test("disabled Codex effort variant requests are rejected at the routing boundary", async () => {
  delete process.env.MODEL_EFFORT_VARIANTS_ENABLED;
  const result = await resolveModelOrError(
    "codex/gpt-5.6-sol-low",
    { model: "codex/gpt-5.6-sol-low", input: [] },
    "/v1/responses"
  );
  assert.ok(result.error instanceof Response);
  assert.equal(result.error.status, 400);
});

test("the default /v1/models Codex catalog contains base models but no effort variants", async () => {
  await providersDb.createProviderConnection({
    provider: "codex",
    authType: "oauth",
    name: "codex-effort-setting-catalog",
    accessToken: "test-token",
    isActive: true,
    testStatus: "active",
  });

  const response = await catalog.getUnifiedModelsResponse(
    new Request("http://localhost/v1/models?prefix=canonical")
  );
  const body = (await response.json()) as { data: Array<{ id: string; owned_by?: string }> };
  const codexIds = body.data.filter((model) => model.owned_by === "codex").map((model) => model.id);

  assert.ok(codexIds.some((id) => id.endsWith("gpt-5.6-sol")));
  assert.equal(
    codexIds.some((id) => /-(?:low|medium|high|xhigh|max|ultra)$/.test(id)),
    false
  );
});
