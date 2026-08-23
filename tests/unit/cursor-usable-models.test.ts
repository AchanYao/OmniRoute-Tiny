import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  decodeGetUsableModelsResponse,
  fetchCursorUsableModels,
  collapseCursorUsableModels,
} from "../../open-sse/services/cursorUsableModels";
import { encodeBytes, encodeString } from "../../open-sse/utils/cursorAgentProtobuf/wire";
import { resolveRequestedModel } from "../../open-sse/utils/cursorAgentProtobuf";

describe("Cursor Usable Models Discovery (omp GetUsableModels RPC)", () => {
  it("decodeGetUsableModelsResponse decodes ModelDetails protobuf message", () => {
    const model1 = Buffer.concat([
      encodeString(1, "claude-3-7-sonnet"),
      encodeString(2, "Claude 3.7 Sonnet"),
    ]);
    const model2 = Buffer.concat([
      encodeString(1, "composer-2.5"),
      encodeString(2, "Composer 2.5"),
    ]);

    const responseMsg = Buffer.concat([encodeBytes(1, model1), encodeBytes(1, model2)]);

    // Connect-RPC frame header: 0x00 + 4-byte uint32 length
    const frameHeader = Buffer.alloc(5);
    frameHeader[0] = 0x00;
    frameHeader.writeUInt32BE(responseMsg.length, 1);

    const payload = Buffer.concat([frameHeader, responseMsg]);
    const decoded = decodeGetUsableModelsResponse(payload);

    assert.equal(decoded.length, 2);
    assert.equal(decoded[0].id, "claude-3-7-sonnet");
    assert.equal(decoded[0].name, "Claude 3.7 Sonnet");
    assert.equal(decoded[1].id, "composer-2.5");
    assert.equal(decoded[1].name, "Composer 2.5");
  });

  it("fetchCursorUsableModels returns null when accessToken is missing", async () => {
    const res = await fetchCursorUsableModels({ accessToken: "" });
    assert.equal(res, null);
  });

  it("collapseCursorUsableModels merges variant suffixes into base models while retaining raw entries", () => {
    const rawModels = [
      {
        id: "claude-3-7-sonnet-high",
        name: "Claude 3.7 Sonnet High",
        owned_by: "cursor" as const,
      },
      { id: "claude-3-7-sonnet-low", name: "Claude 3.7 Sonnet Low", owned_by: "cursor" as const },
      { id: "gpt-5.5-high-fast", name: "GPT-5.5 High Fast", owned_by: "cursor" as const },
    ];

    const collapsed = collapseCursorUsableModels(rawModels);

    // Base models created first
    assert.equal(collapsed[0].id, "claude-3-7-sonnet");
    assert.equal(collapsed[0].name, "Claude 3.7 Sonnet");
    assert.equal(collapsed[1].id, "gpt-5.5");
    assert.equal(collapsed[1].name, "GPT-5.5");

    // Raw models preserved
    assert.ok(collapsed.some((m) => m.id === "claude-3-7-sonnet-high"));
    assert.ok(collapsed.some((m) => m.id === "claude-3-7-sonnet-low"));
    assert.ok(collapsed.some((m) => m.id === "gpt-5.5-high-fast"));
  });

  it("resolveRequestedModel extracts reasoning/effort and fast parameters cleanly", () => {
    const gptHighFast = resolveRequestedModel("gpt-5.5-high-fast");
    assert.equal(gptHighFast.modelId, "gpt-5.5");
    assert.deepEqual(gptHighFast.parameters, [
      { id: "reasoning", value: "high" },
      { id: "fast", value: "true" },
    ]);

    const claudeLow = resolveRequestedModel("cursor-oauth/claude-3-7-sonnet-low");
    assert.equal(claudeLow.modelId, "claude-3-7-sonnet");
    assert.deepEqual(claudeLow.parameters, [{ id: "effort", value: "low" }]);

    const composerFast = resolveRequestedModel("composer-2.5-fast");
    assert.equal(composerFast.modelId, "composer-2.5");
    assert.deepEqual(composerFast.parameters, [{ id: "fast", value: "true" }]);
  });
});
