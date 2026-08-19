import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-memory-tools-"));
const originalDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = tmpDir;

const core = await import("../../src/lib/db/core.ts");
const { memoryTools } = await import("../../open-sse/mcp-server/tools/memoryTools.ts");
const memoryStore = await import("../../src/lib/memory/store.ts");
const settingsDb = await import("../../src/lib/db/settings.ts");
const { invalidateMemorySettingsCache } = await import("../../src/lib/memory/settings.ts");

function resetStorage() {
  core.resetDbInstance();
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });
  core.getDbInstance();
}

test.beforeEach(async () => {
  resetStorage();
  // PRD-2026-06-19: memory is OFF by default now. The memory MCP tools operate
  // within the memory subsystem (omniroute_memory_search → retrieveMemories, which
  // returns nothing while memory is disabled), so enable memory explicitly — the
  // realistic precondition for a client using the memory tools.
  await settingsDb.updateSettings({ memoryEnabled: true });
  invalidateMemorySettingsCache();
});

test.after(() => {
  core.resetDbInstance();
  process.env.DATA_DIR = originalDataDir;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("memory search filters by type, enforces limit, and reports token totals", async () => {
  await memoryStore.createMemory({
    apiKeyId: "key-search",
    sessionId: "search",
    type: "factual",
    key: "pref:stack",
    content: "TypeScript and Node.js are used for backend work.",
    metadata: { source: "user" },
    expiresAt: null,
  });
  await memoryStore.createMemory({
    apiKeyId: "key-search",
    sessionId: "search",
    type: "semantic",
    key: "pref:hobby",
    content: "Gardening is a weekend hobby.",
    metadata: { source: "user" },
    expiresAt: null,
  });
  await memoryStore.createMemory({
    apiKeyId: "key-search",
    sessionId: "search",
    type: "factual",
    key: "pref:language",
    content: "TypeScript services are written every day.",
    metadata: { source: "user" },
    expiresAt: null,
  });

  const result = await memoryTools.omniroute_memory_search.handler({
    apiKeyId: "key-search",
    query: "typescript backend",
    type: "factual",
    limit: 1,
  });

  assert.equal(result.success, true);
  assert.equal(result.data.count, 1);
  assert.equal(result.data.memories.length, 1);
  assert.equal(result.data.memories[0].type, "factual");
  assert.match(result.data.memories[0].content, /TypeScript/i);
  assert.ok(result.data.totalTokens > 0);
});
test("memory search respects a configured zero token budget", async () => {
  await settingsDb.updateSettings({ memoryEnabled: true, memoryMaxTokens: 0 });
  invalidateMemorySettingsCache();

  await memoryStore.createMemory({
    apiKeyId: "key-zero-budget",
    sessionId: "",
    type: "factual",
    key: "pref:stack",
    content: "TypeScript and Node.js are used for backend work.",
    metadata: {},
    expiresAt: null,
  });

  const result = await memoryTools.omniroute_memory_search.handler({
    apiKeyId: "key-zero-budget",
    query: "typescript",
  });

  assert.equal(result.success, true);
  assert.equal(result.data.count, 0);
  assert.deepEqual(result.data.memories, []);
  assert.equal(result.data.totalTokens, 0);
});

test("memory search runs explicitly even when global memory injection is disabled", async () => {
  await settingsDb.updateSettings({ memoryEnabled: false, memoryMaxTokens: 2000 });
  invalidateMemorySettingsCache();

  await memoryStore.createMemory({
    apiKeyId: "key-disabled-memory",
    sessionId: "",
    type: "factual",
    key: "pref:stack",
    content: "TypeScript and Node.js are used for backend work.",
    metadata: {},
    expiresAt: null,
  });

  const result = await memoryTools.omniroute_memory_search.handler({
    apiKeyId: "key-disabled-memory",
    query: "typescript",
    maxTokens: 500,
  });

  assert.equal(result.success, true);
  assert.equal(result.data.count, 1);
  assert.equal(result.data.memories.length, 1);
  assert.match(result.data.memories[0].content, /TypeScript/i);
  assert.ok(result.data.totalTokens > 0);
});
