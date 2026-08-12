/**
 * Issue #6922 retirement — OmniRoute no longer synthesizes OpenCode Go
 * effort-suffixed model IDs. Clients must use the base model plus
 * request-level reasoning_effort.
 */

import test from "node:test";
import assert from "node:assert/strict";

const { OpencodeExecutor } = await import("../../open-sse/executors/opencode.ts");
const { REGISTRY } = await import("../../open-sse/config/providerRegistry.ts");

const RETIRED_ALIASES = [
  "deepseek-v4-pro-low",
  "deepseek-v4-pro-medium",
  "deepseek-v4-pro-high",
  "deepseek-v4-pro-max",
  "glm-5.2-high",
  "glm-5.2-max",
  "mimo-v2.5-high",
  "mimo-v2.5-max",
] as const;

test("#6922 retirement: synthetic effort aliases are absent from opencode-go", () => {
  const ids = new Set((REGISTRY["opencode-go"]?.models ?? []).map((m) => m.id));
  for (const alias of RETIRED_ALIASES) {
    assert.equal(ids.has(alias), false, `${alias} must not remain registered`);
  }
  for (const base of ["deepseek-v4-pro", "glm-5.2", "mimo-v2.5"]) {
    assert.ok(ids.has(base), `${base} base model must remain`);
  }
});

test("#6922 retirement: transformRequest leaves base model + reasoning_effort unchanged", () => {
  const executor = new OpencodeExecutor("opencode-go");
  const body = {
    model: "deepseek-v4-pro",
    reasoning_effort: "high",
    messages: [{ role: "user", content: "hi" }],
  };
  const out = executor.transformRequest("deepseek-v4-pro", body, true, { apiKey: "k" });
  assert.equal(out.model, "deepseek-v4-pro");
  assert.equal(out.reasoning_effort, "high");
});

test("#6922 retirement: transformRequest does not rewrite retired alias ids", () => {
  const executor = new OpencodeExecutor("opencode-go");
  const body = {
    model: "glm-5.2-high",
    messages: [{ role: "user", content: "hi" }],
  };
  const out = executor.transformRequest("glm-5.2-high", body, true, { apiKey: "k" });
  assert.equal(out.model, "glm-5.2-high");
  assert.equal(out.reasoning_effort, undefined);
});
