import test from "node:test";
import assert from "node:assert/strict";

import { getModelsByProviderId } from "../../open-sse/config/providerModels.ts";

test("Codex registry does not maintain GPT model IDs", () => {
  assert.deepEqual(getModelsByProviderId("codex"), []);
});

test("Codex catalog no longer exposes GPT-5.4 models", () => {
  const models = getModelsByProviderId("codex");

  assert.deepEqual(
    models.filter((model) => model.id.startsWith("gpt-5.4")).map((model) => model.id),
    []
  );
});
