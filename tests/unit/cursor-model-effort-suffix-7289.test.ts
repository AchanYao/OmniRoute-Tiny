import test from "node:test";
import assert from "node:assert/strict";
import { resolveRequestedModel } from "../../open-sse/utils/cursorAgentProtobuf";

test("resolveRequestedModel passes model ids verbatim without effort suffix splitting", () => {
  assert.deepEqual(resolveRequestedModel("claude-opus-4-8-high"), {
    modelId: "claude-opus-4-8-high",
    parameters: [],
  });
  assert.deepEqual(resolveRequestedModel("claude-sonnet-5-high"), {
    modelId: "claude-sonnet-5-high",
    parameters: [],
  });
  assert.deepEqual(resolveRequestedModel("gpt-5.5-high"), {
    modelId: "gpt-5.5-high",
    parameters: [],
  });
});

test("resolveRequestedModel handles composer -fast toggle", () => {
  assert.deepEqual(resolveRequestedModel("composer-2-fast"), {
    modelId: "composer-2",
    parameters: [{ id: "fast", value: "true" }],
  });
});

test("resolveRequestedModel leaves standard ids untouched", () => {
  assert.deepEqual(resolveRequestedModel("claude-2.5"), {
    modelId: "claude-2.5",
    parameters: [],
  });
  assert.deepEqual(resolveRequestedModel("gpt-4o"), {
    modelId: "gpt-4o",
    parameters: [],
  });
});
