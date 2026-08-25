import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { filterModels, resolveOmpApi } from "../src/index.js";

describe("OMP Plugin Model Filter & API Resolver", () => {
  it("filters out image, embedding, rerank, audio, and video models", () => {
    const rawModels = [
      { id: "gpt-5.4", type: "chat", owned_by: "openai" },
      { id: "dall-e-3", type: "image", owned_by: "openai" },
      { id: "text-embedding-3", type: "embedding", owned_by: "openai" },
      { id: "bge-reranker", type: "rerank", owned_by: "bge" },
      { id: "whisper-large", type: "audio", owned_by: "openai" },
      { id: "sora-1.0", type: "video", owned_by: "openai" },
    ];

    const filtered = filterModels(rawModels);
    assert.deepEqual(
      filtered.map((m) => m.id),
      ["gpt-5.4"]
    );
  });

  it("maps catalog api_format / targetFormat to OMP native API endpoints", () => {
    assert.equal(
      resolveOmpApi({ id: "claude-sonnet", api_format: "anthropic" }),
      "anthropic-messages"
    );
    assert.equal(
      resolveOmpApi({ id: "claude-sonnet", api_format: "claude" }),
      "anthropic-messages"
    );
    assert.equal(resolveOmpApi({ id: "claude-sonnet", api_format: "cc" }), "anthropic-messages");
    assert.equal(resolveOmpApi({ id: "gemini-pro", api_format: "google" }), "google-generative-ai");
    assert.equal(resolveOmpApi({ id: "gemini-pro", api_format: "gemini" }), "google-generative-ai");
    assert.equal(
      resolveOmpApi({ id: "gpt-5", api_format: "openai-responses" }),
      "openai-responses"
    );
    assert.equal(resolveOmpApi({ id: "gpt-5", api_format: "responses" }), "openai-responses");
    assert.equal(resolveOmpApi({ id: "codex-5", api_format: "codex" }), "openai-responses");
    assert.equal(
      resolveOmpApi({ id: "gpt-4", api_format: "chat-completions" }),
      "openai-completions"
    );
    assert.equal(resolveOmpApi({ id: "gpt-4", api_format: "openai" }), "openai-completions");
  });

  it("defaults to openai-completions when api_format is absent, even for foreign model IDs", () => {
    // Crucial for Cursor / Gemini subscription / multi-vendor proxies serving Claude or Gemini via standard OmniRoute endpoint
    assert.equal(
      resolveOmpApi({ id: "claude-3-5-sonnet", owned_by: "anthropic" }),
      "openai-completions"
    );
    assert.equal(resolveOmpApi({ id: "gemini-2.5-pro", owned_by: "google" }), "openai-completions");
    assert.equal(resolveOmpApi({ id: "unknown-model" }), "openai-completions");
  });

  it("keeps untyped models even when id or owned_by looks like media", () => {
    const rawModels = [
      { id: "claude-3-5-sonnet", owned_by: "anthropic" },
      { id: "midjourney-v6-image", owned_by: "midjourney" },
      { id: "flux-1-schnell", owned_by: "black-forest-labs" },
      { id: "tts-1-hd", owned_by: "openai" },
      { id: "custom-model-1", owned_by: "comfyui" },
    ];

    const filtered = filterModels(rawModels);
    assert.deepEqual(
      filtered.map((m) => m.id),
      ["claude-3-5-sonnet", "midjourney-v6-image", "flux-1-schnell", "tts-1-hd", "custom-model-1"]
    );
  });
});
