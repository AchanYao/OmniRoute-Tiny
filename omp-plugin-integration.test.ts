import test from "node:test";
import assert from "node:assert/strict";
import { filterModels, resolveOmpApi } from "../../omp-plugin/src/index.js";

test("OMP Plugin Integration Contract", () => {
  assert.equal(typeof filterModels, "function");
  assert.equal(typeof resolveOmpApi, "function");

  const rawModels = [
    { id: "gpt-4o", type: "chat", api_format: "openai" },
    { id: "dall-e-3", type: "image", api_format: "openai" },
  ];
  const filtered = filterModels(rawModels);
  assert.deepEqual(filtered.map((m) => m.id), ["gpt-4o"]);
  assert.equal(resolveOmpApi({ api_format: "anthropic" }), "anthropic-messages");
});
