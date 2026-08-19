import test from "node:test";
import assert from "node:assert/strict";

import {
  buildQoderToolCompletionPayload,
  buildQoderToolSseStream,
  parseQoderToolRequest,
  QoderToolSessionManager,
} from "../../open-sse/services/qoderCliTools.ts";

const weatherTool = {
  type: "function",
  function: {
    name: "lookup_weather",
    description: "Look up current weather",
    parameters: {
      type: "object",
      properties: { city: { type: "string" } },
      required: ["city"],
      additionalProperties: false,
    },
  },
};

test("parseQoderToolRequest preserves function schemas and privileged instructions", () => {
  const parsed = parseQoderToolRequest({
    messages: [
      { role: "system", content: "You are Codex." },
      { role: "developer", content: "Never guess weather." },
      { role: "user", content: "Weather in Singapore?" },
    ],
    tools: [weatherTool],
  });

  assert.deepEqual(parsed.tools, [
    {
      name: "lookup_weather",
      description: "Look up current weather",
      inputSchema: weatherTool.function.parameters,
    },
  ]);
  assert.equal(parsed.systemPrompt, "You are Codex.\n\nNever guess weather.");
  assert.match(parsed.prompt, /USER:\nWeather in Singapore\?/);
  assert.doesNotMatch(parsed.prompt, /SYSTEM:|DEVELOPER:/);
});

test("tool call payload and SSE use native OpenAI tool_calls finish reason", async () => {
  const calls = [
    {
      id: "call_weather",
      type: "function" as const,
      function: { name: "lookup_weather", arguments: '{"city":"Singapore"}' },
    },
  ];
  const payload = buildQoderToolCompletionPayload({ model: "qwen", toolCalls: calls });
  assert.equal(payload.choices[0].message.content, null);
  assert.deepEqual(payload.choices[0].message.tool_calls, calls);
  assert.equal(payload.choices[0].finish_reason, "tool_calls");

  const stream = buildQoderToolSseStream("qwen", calls);
  const text = await new Response(stream).text();
  assert.match(text, /"tool_calls"/);
  assert.match(text, /"tool_calls":\[\{"index":0/);
  assert.match(text, /"finish_reason":"tool_calls"/);
  assert.match(text, /data: \[DONE\]/);
});

test("QoderToolSessionManager resumes a parked call by OpenAI tool call id", async () => {
  const manager = new QoderToolSessionManager({ idleTtlMs: 1_000 });
  let resolved = "";
  const session = manager.open("conversation-1", {
    close() {},
    resolveToolResult(_id, content) {
      resolved = content;
      return true;
    },
  });
  session.pendingToolCallIds.add("call_weather");
  manager.release(session, "awaiting_tool_result");

  const resumed = manager.findByToolCallIds(["call_weather"]);
  assert.equal(resumed, session);
  assert.equal(manager.sendToolResult(resumed!, "call_weather", '{"temperature":30}'), true);
  assert.equal(resolved, '{"temperature":30}');
  manager.close(session);
});
