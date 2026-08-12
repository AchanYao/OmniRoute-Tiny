import test from "node:test";
import assert from "node:assert/strict";

const { getExecutorTimeoutMs } =
  await import("../../open-sse/handlers/chatCore/upstreamTimeouts.ts");
const { FETCH_TIMEOUT_MS } = await import("../../open-sse/config/constants.ts");
const { getModelTimeoutMs } = await import("../../open-sse/config/providerModels.ts");

test("Codex effort variants no longer carry repository-authored timeout overrides", () => {
  const executor = { getTimeoutMs: () => 30000 };
  const result = getExecutorTimeoutMs(executor, "codex", "gpt-5.5-high");
  assert.equal(result, 30000);
});

test("provider-level timeoutMs still wins over global when no model override exists (regression guard)", () => {
  const executor = { getTimeoutMs: () => 45000 };
  // No model registered for this provider/model combo -> no model override,
  // must still fall back to the provider-level executor.getTimeoutMs().
  const result = getExecutorTimeoutMs(executor, "codex", "gpt-5.5-medium");
  assert.equal(result, 45000);
});

test("global FETCH_TIMEOUT_MS remains the fallback with neither override", () => {
  const executor = {};
  const result = getExecutorTimeoutMs(executor, "codex", "gpt-5.5-medium");
  assert.equal(result, FETCH_TIMEOUT_MS);
});

test("getExecutorTimeoutMs is backward compatible when called with only an executor", () => {
  const executor = { getTimeoutMs: () => 5000 };
  assert.equal(getExecutorTimeoutMs(executor), 5000);
});

test("all gpt-5.5 effort aliases use the same global fallback", () => {
  const executor = {};
  const highResult = getExecutorTimeoutMs(executor, "codex", "gpt-5.5-high");
  const mediumResult = getExecutorTimeoutMs(executor, "codex", "gpt-5.5-medium");
  assert.equal(highResult, FETCH_TIMEOUT_MS);
  assert.equal(mediumResult, FETCH_TIMEOUT_MS);
  assert.equal(highResult, mediumResult);
});

test("getModelTimeoutMs has no Codex effort-tier override", () => {
  assert.equal(getModelTimeoutMs("codex", "gpt-5.5-high"), undefined);
  assert.equal(getModelTimeoutMs("codex", "gpt-5.5-xhigh"), undefined);
  assert.equal(getModelTimeoutMs("codex", "gpt-5.5-medium"), undefined);
  assert.equal(getModelTimeoutMs("codex", "nonexistent-model"), undefined);
});
