import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-virtual-auto-"));
const ORIGINAL_DATA_DIR = process.env.DATA_DIR;

process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../src/lib/db/core.ts");
const providersDb = await import("../../src/lib/db/providers.ts");
const virtualFactory = await import("../../open-sse/services/autoCombo/virtualFactory.ts");

type VirtualComboResult = Awaited<ReturnType<typeof virtualFactory.createVirtualAutoCombo>>;

async function resetStorage() {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

test.beforeEach(async () => {
  await resetStorage();
});

test.after(async () => {
  await resetStorage();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });

  if (ORIGINAL_DATA_DIR === undefined) {
    delete process.env.DATA_DIR;
  } else {
    process.env.DATA_DIR = ORIGINAL_DATA_DIR;
  }
});

test("createVirtualAutoCombo returns an executable auto combo for API-key connections", async () => {
  await providersDb.createProviderConnection({
    provider: "openai",
    authType: "apikey",
    name: "OpenAI",
    apiKey: "sk-test-openai",
    defaultModel: "gpt-4o-mini",
  });

  const combo: VirtualComboResult = await virtualFactory.createVirtualAutoCombo("fast");

  assert.equal(combo.strategy, "auto");
  assert.ok(combo.models.length >= 1);
  const openaiModel = combo.models.find(
    (model) => model.providerId === "openai" && model.model === "openai/gpt-4o-mini"
  );
  assert.ok(openaiModel, "the configured default must remain among registry candidates");
  assert.equal(openaiModel.kind, "model");
  assert.equal(combo.autoConfig.routerStrategy, "lkgp");
  assert.ok(combo.autoConfig.candidatePool.includes("openai"));
});

test("createVirtualAutoCombo includes OAuth accessToken connections with real expiry fields", async () => {
  await providersDb.createProviderConnection({
    provider: "anthropic",
    authType: "oauth",
    email: "oauth@example.com",
    accessToken: "oauth-access-token",
    tokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    defaultModel: "claude-sonnet-4-5",
  });

  const combo: VirtualComboResult = await virtualFactory.createVirtualAutoCombo("coding");

  assert.equal(combo.strategy, "auto");
  assert.ok(combo.models.length >= 1);
  assert.ok(
    combo.models.some(
      (model) => model.providerId === "anthropic" && model.model === "anthropic/claude-sonnet-4-5"
    ),
    "the configured default must remain among registry candidates"
  );
  assert.ok(combo.autoConfig.candidatePool.includes("anthropic"));
});

test("createVirtualAutoCombo includes no-auth OpenCode Free without provider_connections rows", async () => {
  const combo: VirtualComboResult = await virtualFactory.createVirtualAutoCombo("fast");

  const opencode = combo.models.find((model) => model.providerId === "opencode");
  assert.ok(
    opencode,
    "OpenCode Free should appear in auto/* even when it has no provider_connections row"
  );
  assert.equal(opencode.connectionId, "noauth");
  assert.equal(opencode.model, "oc/big-pickle");
  assert.ok(combo.autoConfig.candidatePool.includes("opencode"));
});

test("createVirtualAutoCombo restricts the no-auth pool to the allowlist", async () => {
  // Official OpenCode Free is the remaining no-auth HTTP backend in the auto pool.
  const combo: VirtualComboResult = await virtualFactory.createVirtualAutoCombo("fast");

  for (const allowed of ["opencode"]) {
    const models = combo.models.filter((m) => m.providerId === allowed);
    assert.ok(models.length >= 1, `${allowed} should have at least one model`);
    assert.ok(
      models.every((m) => m.connectionId === "noauth"),
      `all ${allowed} models should use noauth connection`
    );
  }

  for (const excluded of ["auggie", "aihorde", "devin-cli-agentic"]) {
    assert.equal(
      combo.models.some((model) => model.providerId === excluded),
      false,
      `no-auth provider "${excluded}" must be excluded from the auto-combo pool (not in allowlist)`
    );
  }
});

test("createVirtualAutoCombo keeps credential-required providers out when disconnected", async () => {
  const combo: VirtualComboResult = await virtualFactory.createVirtualAutoCombo("fast");

  assert.equal(
    combo.models.some((model) => model.providerId === "openai"),
    false,
    "OpenAI should still require a real active connection"
  );
});
