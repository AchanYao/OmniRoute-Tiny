import assert from "node:assert/strict";
import test from "node:test";

import { aggregateExactSameIdModels } from "../../src/app/api/v1/models/catalogAggregation.ts";
import { completeCatalogThinkingFlags } from "../../src/app/api/v1/models/catalogResponse.ts";

function model(id: string, ownedBy: string, parent: string | null = null) {
  const root = id.slice(id.indexOf("/") + 1);
  return {
    id,
    object: "model",
    owned_by: ownedBy,
    root,
    parent,
    permission: [],
  };
}

test("dual alias and canonical entries from one provider are not aggregated", () => {
  const models = [
    model("cx/shared-model", "cx"),
    model("codex/shared-model", "codex", "cx/shared-model"),
  ];

  assert.deepEqual(aggregateExactSameIdModels(models), models);
});

test("the same raw model from two providers is aggregated once", () => {
  const result = aggregateExactSameIdModels([
    model("cx/shared-model", "cx"),
    model("codex/shared-model", "codex", "cx/shared-model"),
    model("oa/shared-model", "oa"),
    model("openai/shared-model", "openai", "oa/shared-model"),
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].id, "shared-model");
  assert.equal(result[0].owned_by, "aggregate");
  assert.deepEqual(result[0].providers, ["cx", "oa"]);
});

test("aggregate merge keeps reasoning and unions effort tiers across providers", () => {
  const result = aggregateExactSameIdModels([
    {
      ...model("grok-cli/grok-4.6", "grok-cli"),
      name: "Grok 4.6",
      description: "Grok Build session model with reasoning efforts",
      context_length: 500000,
      max_output_tokens: 16384,
      input_modalities: ["text"],
      capabilities: {
        reasoning: true,
        thinking: true,
        supportsThinking: true,
        effort_tiers: ["high", "medium", "low"],
        tool_calling: true,
      },
    },
    {
      ...model("xai/grok-4.6", "xai"),
      name: "grok-4.6",
      context_length: 256000,
      input_modalities: ["text", "image"],
      capabilities: {
        vision: true,
        effort_tiers: ["xhigh", "high"],
      },
    },
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].id, "grok-4.6");
  assert.equal(result[0].owned_by, "aggregate");
  assert.deepEqual(result[0].providers, ["grok-cli", "xai"]);
  assert.equal(result[0].name, "Grok 4.6");
  assert.equal(result[0].description, "Grok Build session model with reasoning efforts");
  assert.equal(result[0].context_length, 256000);
  assert.equal(result[0].max_output_tokens, 16384);
  assert.deepEqual(result[0].input_modalities, ["text", "image"]);
  assert.equal(result[0].capabilities.reasoning, true);
  assert.equal(result[0].capabilities.thinking, true);
  assert.equal(result[0].capabilities.supportsThinking, true);
  assert.equal(result[0].capabilities.vision, true);
  assert.equal(result[0].capabilities.tool_calling, true);
  assert.deepEqual(result[0].capabilities.effort_tiers, ["xhigh", "high", "medium", "low"]);
});

test("aggregate keeps reasoning and effort tiers when only one provider declares them", () => {
  const result = aggregateExactSameIdModels([
    {
      ...model("grok-cli/grok-4.6", "grok-cli"),
      capabilities: {
        reasoning: true,
        thinking: true,
        supportsThinking: true,
        effort_tiers: ["xhigh", "high", "medium", "low"],
      },
    },
    {
      ...model("xai/grok-4.6", "xai"),
    },
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].owned_by, "aggregate");
  assert.equal(result[0].capabilities.reasoning, true);
  assert.equal(result[0].capabilities.supportsThinking, true);
  assert.deepEqual(result[0].capabilities.effort_tiers, ["xhigh", "high", "medium", "low"]);
});

test("aggregate infers thinking flags from effort_tiers-only synced members", () => {
  const result = aggregateExactSameIdModels([
    {
      ...model("grok-cli/grok-4.6", "grok-cli"),
      capabilities: { effort_tiers: ["xhigh", "high", "medium", "low"] },
    },
    {
      ...model("xai/grok-4.6", "xai"),
    },
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].owned_by, "aggregate");
  assert.equal(result[0].capabilities.supportsThinking, true);
  assert.equal(result[0].capabilities.thinking, true);
  assert.equal(result[0].capabilities.reasoning, true);
  assert.deepEqual(result[0].capabilities.effort_tiers, ["xhigh", "high", "medium", "low"]);
});

test("catalog response completes thinking flags for effort_tiers-only entries", () => {
  const entry = {
    ...model("gc/grok-4.6", "grok-cli"),
    capabilities: {
      effort_tiers: ["xhigh", "high", "medium", "low"],
      tool_calling: true,
      reasoning: true,
    },
  };

  const result = completeCatalogThinkingFlags(entry);

  assert.equal(result.capabilities.supportsThinking, true);
  assert.equal(result.capabilities.thinking, true);
  assert.deepEqual(result.capabilities.effort_tiers, ["xhigh", "high", "medium", "low"]);
});

test("catalog response preserves an explicit false thinking capability", () => {
  const result = completeCatalogThinkingFlags({
    ...model("provider/fixed-effort-model", "provider"),
    capabilities: {
      effort_tiers: ["low", "high"],
      supportsThinking: false,
    },
  });

  assert.equal(result.capabilities.supportsThinking, false);
  assert.equal(result.capabilities.thinking, false);
});
