import test from "node:test";
import assert from "node:assert/strict";

import { getModelsByProviderId } from "../../open-sse/config/providerModels.ts";

test("Codex catalog exposes one base entry per GPT-5.6 model by default", () => {
  const models = getModelsByProviderId("codex");
  const expectedIds = ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"];

  assert.deepEqual(
    models.filter((model) => model.id.startsWith("gpt-5.6-")).map((model) => model.id),
    expectedIds
  );

  for (const modelId of expectedIds) {
    const model = models.find((entry) => entry.id === modelId);
    assert.ok(model, `codex must expose ${modelId}`);
    assert.equal(model.contextLength, 1050000);
    assert.equal(model.maxInputTokens, 922000);
    assert.equal(model.maxOutputTokens, 128000);
    assert.equal(model.targetFormat, "openai-responses");
    assert.equal(model.toolCalling, true);
    assert.equal(model.supportsReasoning, true);
    assert.equal(model.supportsVision, true);
    assert.equal(model.supportsXHighEffort, true);
  }

  assert.equal(
    models.some((model) => /-(?:low|medium|high|xhigh|max|ultra)$/.test(model.id)),
    false
  );
});

test("Codex catalog no longer exposes GPT-5.4 models", () => {
  const models = getModelsByProviderId("codex");

  assert.deepEqual(
    models.filter((model) => model.id.startsWith("gpt-5.4")).map((model) => model.id),
    []
  );
});
