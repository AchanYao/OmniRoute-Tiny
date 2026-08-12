import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCrossProxyModelId,
  parseModel,
  stripContextWindowSuffix,
} from "../../open-sse/services/model.ts";

test("context-window suffix helper strips client tags without changing the base model", () => {
  assert.strictEqual(stripContextWindowSuffix("my-glm52[500k]"), "my-glm52");
});

// [1m] extended context suffix — PR #311 (DavyMassoneto)
test("[1m] suffix: strips suffix and sets extendedContext=true", () => {
  const result = parseModel("claude-sonnet-4-6[1m]");
  assert.strictEqual(result.model, "claude-sonnet-4-6");
  assert.strictEqual(result.extendedContext, true);
});

test("[1M] suffix: preserves the extended-context flag case-insensitively", () => {
  const result = parseModel("claude-sonnet-4-6[1M]");
  assert.strictEqual(result.model, "claude-sonnet-4-6");
  assert.strictEqual(result.extendedContext, true);
});

test("[1m] suffix: normal model has extendedContext=false", () => {
  const result = parseModel("claude-sonnet-4-6");
  assert.strictEqual(result.model, "claude-sonnet-4-6");
  assert.strictEqual(result.extendedContext, false);
});

test("[1m] suffix: works with provider prefix", () => {
  const result = parseModel("claude/claude-sonnet-4-6[1m]");
  assert.strictEqual(result.model, "claude-sonnet-4-6");
  assert.strictEqual(result.extendedContext, true);
});

test("parseModel does not route the removed cx prefix to Codex", () => {
  const result = parseModel("  cx / gpt-5.6-sol  ");
  assert.strictEqual(result.providerAlias, "cx");
  assert.strictEqual(result.provider, "cx");
  assert.strictEqual(result.model, "gpt-5.6-sol");
});

test("parseModel treats exact slashful model ids as models, not provider prefixes", () => {
  const result = parseModel("openai/gpt-oss-120b");
  assert.strictEqual(result.provider, null);
  assert.strictEqual(result.providerAlias, null);
  assert.strictEqual(result.isAlias, true);
  assert.strictEqual(result.model, "openai/gpt-oss-120b");
});

test("normalizeCrossProxyModelId maps supported external dialects to canonical ids", () => {
  const previous = process.env.MODEL_ALIAS_COMPAT_ENABLED;
  process.env.MODEL_ALIAS_COMPAT_ENABLED = "true";
  try {
    assert.deepEqual(normalizeCrossProxyModelId("gpt-oss:120b"), {
      modelId: "gpt-oss-120b",
      applied: true,
      original: "gpt-oss:120b",
    });
    assert.deepEqual(normalizeCrossProxyModelId("qwen3-coder:480b"), {
      modelId: "Qwen/Qwen3-Coder-480B-A35B-Instruct",
      applied: true,
      original: "qwen3-coder:480b",
    });
  } finally {
    if (previous === undefined) delete process.env.MODEL_ALIAS_COMPAT_ENABLED;
    else process.env.MODEL_ALIAS_COMPAT_ENABLED = previous;
  }
});

test("cross-proxy model aliases are disabled unless explicitly enabled", () => {
  const previous = process.env.MODEL_ALIAS_COMPAT_ENABLED;
  delete process.env.MODEL_ALIAS_COMPAT_ENABLED;
  try {
    assert.deepEqual(normalizeCrossProxyModelId("gpt-oss:120b"), {
      modelId: "gpt-oss:120b",
      applied: false,
      original: null,
    });
    process.env.MODEL_ALIAS_COMPAT_ENABLED = "yes";
    assert.equal(normalizeCrossProxyModelId("gpt-oss:120b").applied, true);
    process.env.MODEL_ALIAS_COMPAT_ENABLED = "unexpected";
    assert.equal(normalizeCrossProxyModelId("gpt-oss:120b").applied, false);
  } finally {
    if (previous === undefined) delete process.env.MODEL_ALIAS_COMPAT_ENABLED;
    else process.env.MODEL_ALIAS_COMPAT_ENABLED = previous;
  }
});
