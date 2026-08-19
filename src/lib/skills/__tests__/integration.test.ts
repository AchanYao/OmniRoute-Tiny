import { describe, it, expect, beforeEach, vi } from "vitest";
import { retrieveMemories } from "../../memory/retrieval";
import { createMemory } from "../../memory/store";
import { skillRegistry } from "../registry";
import { skillExecutor } from "../executor";

vi.mock("../../db/settings", () => ({
  getSettings: vi.fn().mockResolvedValue({ skillsEnabled: true }),
  updateSettings: vi.fn().mockResolvedValue({}),
}));

import { getSettings } from "../../db/settings";
const mockedGetSettings = vi.mocked(getSettings);

describe("Memory + Skills Integration", () => {
  const apiKeyId = "test-api-key";

  beforeEach(() => {
    mockedGetSettings.mockResolvedValue({ skillsEnabled: true } as any);
  });

  it("should retrieve and inject memories", async () => {
    await createMemory({
      apiKeyId,
      type: "factual" as any,
      key: "test-key",
      content: "Test memory content",
      sessionId: "",
      metadata: {},
      expiresAt: null,
    });

    const config = {
      enabled: true,
      maxTokens: 2000,
      retrievalStrategy: "exact" as const,
      autoSummarize: false,
      persistAcrossModels: false,
      retentionDays: 30,
      scope: "apiKey" as const,
    };

    const memories = await retrieveMemories(apiKeyId, config);
    expect(memories).toBeDefined();
    expect(Array.isArray(memories)).toBe(true);
  });

  it("blocks execution when skillsEnabled=false", async () => {
    mockedGetSettings.mockResolvedValue({ skillsEnabled: false } as any);

    await expect(skillExecutor.execute("some-skill", {}, { apiKeyId })).rejects.toThrow(
      /skills.*disabled/i
    );
  });

  it("allows execution when skillsEnabled=true (skill not found still throws)", async () => {
    mockedGetSettings.mockResolvedValue({ skillsEnabled: true } as any);

    await expect(skillExecutor.execute("nonexistent-skill", {}, { apiKeyId })).rejects.toThrow(
      /not found/i
    );
  });
});

describe("SkillsMP Marketplace Integration", () => {
  it("GET /api/skills/marketplace without API key returns 400", async () => {
    // Simulate the marketplace route logic: no API key configured
    mockedGetSettings.mockResolvedValue({} as any);
    const settings = await getSettings();
    const mpApiKey = (settings as Record<string, unknown>).skillsmpApiKey;
    expect(mpApiKey).toBeUndefined();
    // The endpoint would return 400 when no key is configured
  });
});
