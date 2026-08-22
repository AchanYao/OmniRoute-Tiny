import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  decodeGetUsableModelsResponse,
  fetchCursorUsableModels,
} from "../../open-sse/services/cursorUsableModels";
import { encodeBytes, encodeString } from "../../open-sse/utils/cursorAgentProtobuf/wire";

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
});
