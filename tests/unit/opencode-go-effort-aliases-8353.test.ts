/**
 * Issue #8353 retirement — OpenCode Go effort-tier aliases are no longer
 * registered or rewritten by OmniRoute.
 */

import test from "node:test";
import assert from "node:assert/strict";

const { OpencodeExecutor } = await import("../../open-sse/executors/opencode.ts");
const { REGISTRY } = await import("../../open-sse/config/providerRegistry.ts");

const RETIRED_ALIASES = [
  "deepseek-v4-flash-high",
  "deepseek-v4-flash-max",
  "grok-4.5-low",
  "grok-4.5-medium",
  "grok-4.5-high",
  "hy3-none",
  "hy3-low",
  "hy3-high",
  "kimi-k3-max",
  "qwen3.6-plus-high",
  "qwen3.6-plus-max",
  "qwen3.7-max-high",
  "qwen3.7-max-max",
  "qwen3.7-plus-high",
  "qwen3.7-plus-max",
] as const;

const BASES = [
  "deepseek-v4-flash",
  "grok-4.5",
  "hy3",
  "kimi-k3",
  "qwen3.6-plus",
  "qwen3.7-max",
  "qwen3.7-plus",
] as const;

function goIds() {
  return new Set((REGISTRY["opencode-go"]?.models ?? []).map((m) => m.id));
}

function zenIds() {
  return new Set((REGISTRY["opencode-zen"]?.models ?? []).map((m) => m.id));
}

test("#8353 retirement: base models remain on opencode-go", () => {
  const ids = goIds();
  for (const base of BASES) {
    assert.ok(ids.has(base), `opencode-go must keep base model ${base}`);
  }
});

test("#8353 retirement: synthetic aliases are absent from opencode-go and zen", () => {
  const go = goIds();
  const zen = zenIds();
  for (const alias of RETIRED_ALIASES) {
    assert.equal(go.has(alias), false, `opencode-go must not expose ${alias}`);
    assert.equal(zen.has(alias), false, `opencode-zen must not expose ${alias}`);
  }
});

test("#8353 retirement: hy3-preview remains distinct from hy3", () => {
  const ids = goIds();
  assert.ok(ids.has("hy3"));
  assert.ok(ids.has("hy3-preview"));
});

test("#8353 retirement: transformRequest no longer rewrites retired aliases", () => {
  const executor = new OpencodeExecutor("opencode-go");
  const out = executor.transformRequest(
    "deepseek-v4-flash-high",
    { model: "deepseek-v4-flash-high", messages: [{ role: "user", content: "hi" }] },
    true,
    { apiKey: "k" }
  );
  assert.equal(out.model, "deepseek-v4-flash-high");
  assert.equal(out.reasoning_effort, undefined);
});

test("#8353 retirement: request-level effort on base models is preserved", () => {
  const executor = new OpencodeExecutor("opencode-go");
  const out = executor.transformRequest(
    "grok-4.5",
    {
      model: "grok-4.5",
      reasoning_effort: "high",
      messages: [{ role: "user", content: "hi" }],
    },
    true,
    { apiKey: "k" }
  );
  assert.equal(out.model, "grok-4.5");
  assert.equal(out.reasoning_effort, "high");
});
