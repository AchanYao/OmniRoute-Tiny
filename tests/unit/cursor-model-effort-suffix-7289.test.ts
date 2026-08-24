import test from "node:test";
import assert from "node:assert/strict";
import { resolveRequestedModel } from "../../open-sse/utils/cursorAgentProtobuf";

test("resolveRequestedModel passes model ids verbatim without effort suffix splitting", () => {
  assert.deepEqual(resolveRequestedModel("claude-opus-4-8-high"), {
    modelId: "claude-opus-4-8-high",
    wireModelId: "claude-opus-4-8-high",
    catalogModelId: "claude-opus-4-8-high",
    displayName: "claude-opus-4-8-high",
    parameters: [],
  });
  assert.deepEqual(resolveRequestedModel("claude-sonnet-5-high"), {
    modelId: "claude-sonnet-5-high",
    wireModelId: "claude-sonnet-5-high",
    catalogModelId: "claude-sonnet-5-high",
    displayName: "claude-sonnet-5-high",
    parameters: [],
  });
  assert.deepEqual(resolveRequestedModel("gpt-5.5-high"), {
    modelId: "gpt-5.5",
    wireModelId: "gpt-5.5",
    catalogModelId: "gpt-5.5-high",
    displayName: "gpt-5.5-high",
    parameters: [{ id: "reasoning", value: "high" }],
  });
});

test("resolveRequestedModel handles composer -fast toggle", () => {
  assert.deepEqual(resolveRequestedModel("composer-2-fast"), {
    modelId: "composer-2",
    wireModelId: "composer-2",
    catalogModelId: "composer-2-fast",
    displayName: "composer-2-fast",
    parameters: [{ id: "fast", value: "true" }],
  });
});

test("resolveRequestedModel leaves standard ids untouched", () => {
  assert.deepEqual(resolveRequestedModel("claude-2.5"), {
    modelId: "claude-2.5",
    wireModelId: "claude-2.5",
    catalogModelId: "claude-2.5",
    displayName: "claude-2.5",
    parameters: [],
  });
  assert.deepEqual(resolveRequestedModel("gpt-4o"), {
    modelId: "gpt-4o",
    wireModelId: "gpt-4o",
    catalogModelId: "gpt-4o",
    displayName: "gpt-4o",
    parameters: [],
  });
});
