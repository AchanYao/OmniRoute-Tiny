import { describe, expect, it } from "vitest";
import { filterModels, resolveOmpApi } from "../src/index.js";

describe("OMP Plugin Model Filter & API Resolver", () => {
  it("filters out non-chat models (image, embedding, audio, rerank, video)", () => {
    const rawModels = [
      { id: "gpt-4o", type: "chat", api_format: "openai" },
      { id: "dall-e-3", type: "image", api_format: "openai" },
      { id: "text-embedding-3", type: "embedding", api_format: "openai" },
      { id: "whisper-1", type: "audio", api_format: "openai" },
      { id: "bge-reranker", type: "rerank", api_format: "openai" },
      { id: "claude-3-5-sonnet", type: "chat", api_format: "anthropic" },
      { id: "sora-v1", type: "video", api_format: "openai" },
    ];

    const filtered = filterModels(rawModels);
    expect(filtered.map((m) => m.id)).toEqual(["gpt-4o", "claude-3-5-sonnet"]);
  });

  it("retains vision-capable chat models", () => {
    const rawModels = [
      { id: "gpt-4o-vision", type: "chat", input: ["text", "image"], api_format: "openai" },
    ];
    const filtered = filterModels(rawModels);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("gpt-4o-vision");
  });

  it("maps catalog api_format / targetFormat to OMP native API endpoints", () => {
    expect(resolveOmpApi({ api_format: "anthropic" })).toBe("anthropic-messages");
    expect(resolveOmpApi({ api_format: "claude" })).toBe("anthropic-messages");
    expect(resolveOmpApi({ api_format: "cc" })).toBe("anthropic-messages");
    expect(resolveOmpApi({ api_format: "google" })).toBe("google-generative-ai");
    expect(resolveOmpApi({ api_format: "gemini" })).toBe("google-generative-ai");
    expect(resolveOmpApi({ api_format: "openai-responses" })).toBe("openai-responses");
    expect(resolveOmpApi({ api_format: "codex" })).toBe("openai-responses");
    expect(resolveOmpApi({ api_format: "openai" })).toBe("openai-completions");
    expect(resolveOmpApi({})).toBe("openai-completions");
  });
});
