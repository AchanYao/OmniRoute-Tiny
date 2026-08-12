import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const previousDataDir = process.env.DATA_DIR;
const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-codex-effort-setting-"));
process.env.DATA_DIR = testDataDir;
process.env.API_KEY_SECRET ||= "codex-effort-setting-test-secret";

const { getModelsByProviderId } = await import("../../open-sse/config/providerModels.ts");
const { resolveModelOrError } = await import("../../src/sse/handlers/chatHelpers.ts");
const providersDb = await import("../../src/lib/db/providers.ts");
const catalog = await import("../../src/app/api/v1/models/catalog.ts");

test.after(async () => {
  const core = await import("../../src/lib/db/core.ts");
  core.resetDbInstance();
  fs.rmSync(testDataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
});

test("Codex registry contains protocol metadata but no model inventory", () => {
  assert.deepEqual(getModelsByProviderId("codex"), []);
});

test("retired Codex effort variant requests return migration guidance", async () => {
  const result = await resolveModelOrError(
    "codex/gpt-5.6-sol-low",
    { model: "codex/gpt-5.6-sol-low", input: [] },
    "/v1/responses"
  );
  assert.ok(result.error instanceof Response);
  assert.equal(result.error.status, 400);
  const body = (await result.error.json()) as { error?: { message?: string } };
  assert.match(body.error?.message || "", /reasoning\.effort/);
});

test("the default /v1/models Codex catalog is empty before discovery", async () => {
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

  assert.deepEqual(codexIds, []);
});
