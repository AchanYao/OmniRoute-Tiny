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
  assert.deepEqual(
    filtered.map((m) => m.id),
    ["gpt-4o"]
  );

  // Explicit api_format returned by OmniRoute GET /v1/models
  assert.equal(
    resolveOmpApi({ id: "claude-3-5-sonnet", api_format: "anthropic" }),
    "anthropic-messages"
  );
  assert.equal(
    resolveOmpApi({ id: "gemini-2.5-pro", api_format: "google" }),
    "google-generative-ai"
  );
  assert.equal(resolveOmpApi({ id: "grok-4.6", api_format: "xai" }), "openai-responses");
  assert.equal(resolveOmpApi({ id: "codex-spark", api_format: "responses" }), "openai-responses");

  // Server-driven fallback when api_format is absent (do NOT guess by vendor/ID)
  assert.equal(
    resolveOmpApi({ id: "claude-3-5-sonnet", owned_by: "anthropic" }),
    "openai-completions"
  );
  assert.equal(resolveOmpApi({ id: "gemini-2.5-pro", owned_by: "google" }), "openai-completions");
});
