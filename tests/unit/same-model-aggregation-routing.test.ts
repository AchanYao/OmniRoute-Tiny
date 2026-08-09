import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-same-model-aggregate-"));
const ORIGINAL_DATA_DIR = process.env.DATA_DIR;

process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../src/lib/db/core.ts");
const providersDb = await import("../../src/lib/db/providers.ts");
const chatRoute = await import("../../src/app/api/v1/chat/completions/route.ts");
const responsesRoute = await import("../../src/app/api/v1/responses/route.ts");
const stickiness = await import("../../open-sse/services/combo/sessionStickiness.ts");

const originalFetch = globalThis.fetch;

async function resetStorage() {
  stickiness.clearAllStickyBindings();
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

function anthropicSuccess(model: string): Response {
  return Response.json({
    id: "msg_same_model_aggregate",
    type: "message",
    role: "assistant",
    content: [{ type: "text", text: "OK" }],
    model,
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  });
}

test.beforeEach(async () => {
  globalThis.fetch = originalFetch;
  await resetStorage();
});

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test.after(async () => {
  globalThis.fetch = originalFetch;
  await resetStorage();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  if (ORIGINAL_DATA_DIR === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = ORIGINAL_DATA_DIR;
});

test("bare exact id routes through a sticky priority combo spanning providers", async () => {
  await providersDb.createProviderConnection({
    provider: "openai",
    authType: "apikey",
    name: "same-model-openai",
    apiKey: "sk-same-model-openai",
    defaultModel: "shared-model",
    isActive: true,
    testStatus: "active",
  });
  const anthropic = (await providersDb.createProviderConnection({
    provider: "anthropic",
    authType: "apikey",
    name: "same-model-anthropic",
    apiKey: "sk-same-model-anthropic",
    defaultModel: "shared-model",
    isActive: true,
    testStatus: "active",
  })) as { id: string };

  const messages = [{ role: "user", content: "Keep this conversation on one provider." }];
  const messageHash = stickiness.deriveMessageHash(messages);
  assert.ok(messageHash);
  stickiness.recordStickyBinding(messageHash, anthropic.id);

  const urls: string[] = [];
  globalThis.fetch = async (url: string | URL | Request) => {
    urls.push(String(url));
    return anthropicSuccess("shared-model");
  };

  const response = await chatRoute.POST(
    new Request("http://localhost/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "shared-model", messages, stream: false }),
    })
  );
  const body = await response.text();

  assert.equal(response.status, 200, body);
  assert.ok(urls.length > 0, "expected an upstream request");
  assert.match(urls[0], /api\.anthropic\.com/);
});

test("provider-prefixed ids remain direct routes instead of aggregate aliases", async () => {
  await providersDb.createProviderConnection({
    provider: "openai",
    authType: "apikey",
    name: "same-model-direct-openai",
    apiKey: "sk-same-model-direct-openai",
    defaultModel: "shared-model",
    isActive: true,
    testStatus: "active",
  });
  await providersDb.createProviderConnection({
    provider: "anthropic",
    authType: "apikey",
    name: "same-model-direct-anthropic",
    apiKey: "sk-same-model-direct-anthropic",
    defaultModel: "shared-model",
    isActive: true,
    testStatus: "active",
  });

  const urls: string[] = [];
  globalThis.fetch = async (url: string | URL | Request) => {
    urls.push(String(url));
    return Response.json({
      id: "chatcmpl_same_model_direct",
      choices: [{ message: { role: "assistant", content: "OK" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });
  };

  const response = await chatRoute.POST(
    new Request("http://localhost/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "openai/shared-model",
        messages: [{ role: "user", content: "Use OpenAI directly." }],
        stream: false,
      }),
    })
  );
  const body = await response.text();

  assert.equal(response.status, 200, body);
  assert.ok(urls.length > 0, "expected an upstream request");
  assert.match(urls[0], /api\.openai\.com/);
});

test("Responses API keeps a same-id aggregate bare instead of rewriting it to codex", async () => {
  await providersDb.createProviderConnection({
    provider: "openai",
    authType: "apikey",
    name: "same-model-responses-openai",
    apiKey: "sk-same-model-responses-openai",
    defaultModel: "shared-model",
    isActive: true,
    testStatus: "active",
  });
  await providersDb.createProviderConnection({
    provider: "anthropic",
    authType: "apikey",
    name: "same-model-responses-anthropic",
    apiKey: "sk-same-model-responses-anthropic",
    defaultModel: "shared-model",
    isActive: true,
    testStatus: "active",
  });

  const body = {
    model: "shared-model",
    input: [{ role: "user", content: "Keep the aggregate route." }],
  };
  const resolved = await responsesRoute.withCodexPreferredModel(
    new Request("http://localhost/v1/responses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    body
  );

  assert.equal(resolved.body.model, "shared-model");
});
