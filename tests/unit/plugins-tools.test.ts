import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ── Temp dirs ──
const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-plugins-tools-"));
process.env.DATA_DIR = TEST_DATA_DIR;

// ── Dynamic imports (after DATA_DIR set) ──
const core = await import("../../src/lib/db/core.ts");
const dbPlugins = await import("../../src/lib/db/plugins.ts");
const hooks = await import("../../src/lib/plugins/hooks.ts");
const { pluginTools } = await import("../../open-sse/mcp-server/tools/pluginTools.ts");

// ── Helpers ──

function getTool(name: string) {
  const tool = pluginTools.find((t) => t.name === name);
  assert.ok(tool, `Tool ${name} not found`);
  return tool!;
}

function writeTestPlugin(opts?: { name?: string; onRequest?: boolean }) {
  const name = opts?.name ?? "test-tools-plugin";
  const onRequest = opts?.onRequest ?? true;
  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-plugin-src-"));
  const pluginDir = path.join(sourceDir, name);
  fs.mkdirSync(pluginDir, { recursive: true });
  const manifest = {
    name,
    version: "1.0.0",
    description: "Tools test plugin",
    author: "test",
    main: "index.js",
    hooks: { onRequest, onResponse: false, onError: false },
    enabledByDefault: false,
    requires: { permissions: [] },
    configSchema: {
      apiUrl: { type: "string", description: "API endpoint" },
      maxRetries: { type: "number", min: 1, max: 10, default: 3 },
      debug: { type: "boolean", default: false },
      mode: { type: "string", enum: ["fast", "slow", "auto"], default: "auto" },
    },
  };
  fs.writeFileSync(path.join(pluginDir, "plugin.json"), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(
    path.join(pluginDir, "index.js"),
    onRequest
      ? `module.exports.onRequest = function(ctx) { ctx.metadata = ctx.metadata || {}; ctx.metadata.hookCalled = true; };`
      : `module.exports = {};`
  );
  return { sourceDir, pluginDir, name };
}

const activeSourceDirs: string[] = [];

function cleanupSourceDirs() {
  for (const dir of activeSourceDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {}
  }
  activeSourceDirs.length = 0;
}

// ── Lifecycle ──

test.beforeEach(() => {
  core.resetDbInstance();
  hooks.resetHooks();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  cleanupSourceDirs();
});

test.after(() => {
  core.resetDbInstance();
  cleanupSourceDirs();
  try {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  } catch {}
});

// ── plugin_list ──

test("plugin_list: returns empty when no plugins", async () => {
  const tool = getTool("plugin_list");
  const result = await tool.handler({});
  assert.deepEqual(result.plugins, []);
});

test("plugin_list: returns installed plugins", async () => {
  const { sourceDir, name } = writeTestPlugin({ name: "list-test" });
  activeSourceDirs.push(sourceDir);
  const { pluginManager } = await import("../../src/lib/plugins/manager.ts");
  await pluginManager.install(sourceDir);

  const tool = getTool("plugin_list");
  const result = await tool.handler({});
  assert.equal(result.plugins.length, 1);
  assert.equal(result.plugins[0].name, name);
  assert.equal(result.plugins[0].version, "1.0.0");
  assert.equal(result.plugins[0].enabled, false);
  assert.ok(Array.isArray(result.plugins[0].hooks));

  await pluginManager.uninstall(name);
});

test("plugin_list: filters by status", async () => {
  const { sourceDir, name } = writeTestPlugin({ name: "filter-test" });
  activeSourceDirs.push(sourceDir);
  const { pluginManager } = await import("../../src/lib/plugins/manager.ts");
  await pluginManager.install(sourceDir);

  const tool = getTool("plugin_list");
  const activeResult = await tool.handler({ status: "active" });
  assert.equal(activeResult.plugins.length, 0);

  const installedResult = await tool.handler({ status: "installed" });
  assert.equal(installedResult.plugins.length, 1);

  await pluginManager.uninstall(name);
});

// ── plugin_executions ──

test("plugin_executions: returns execution list", async () => {
  const tool = getTool("plugin_executions");
  const result = await tool.handler({ limit: 10 });
  assert.ok(result !== undefined);
  assert.ok(Array.isArray(result.metrics));
});
