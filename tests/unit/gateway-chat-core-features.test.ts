import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveCompressionSettings } from "../../open-sse/handlers/chatCore/compressionSettings.ts";
import { injectMemoryAndSkills } from "../../open-sse/handlers/chatCore/memorySkillsInjection.ts";
import { FORMATS } from "../../open-sse/translator/formats.ts";

describe("Gateway Edition chat-core feature gates", () => {
  it("preserves the request body without loading Memory or Skills", async () => {
    const body: Record<string, unknown> = {
      model: "gpt-4o",
      messages: [{ role: "user", content: "hello" }],
    };

    const result = await injectMemoryAndSkills({
      body,
      memoryOwnerId: "gateway-owner",
      provider: "openai",
      effectiveModel: "gpt-4o",
      sourceFormat: FORMATS.OPENAI,
      targetFormat: FORMATS.OPENAI,
      backgroundReason: null,
      log: null,
      buildProfile: "gateway",
      loadModules: async () => {
        throw new Error("Gateway request loaded Memory or Skills modules");
      },
    });

    assert.equal(result.body, body);
    assert.equal(result.memorySettings, null);
  });

  it("disables prompt compression without loading its settings", async () => {
    const result = await resolveCompressionSettings(null, {
      buildProfile: "gateway",
      loadSettings: async () => {
        throw new Error("Gateway request loaded compression settings");
      },
    });

    assert.deepEqual(result, {
      settings: null,
      enabled: false,
      contextEditingEnabled: false,
    });
  });
});
