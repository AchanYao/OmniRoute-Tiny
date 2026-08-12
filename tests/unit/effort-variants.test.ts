import assert from "node:assert/strict";
import test from "node:test";

import {
  appendEffortVariants,
  isEffortVariantsEnabled,
  resolveKnownEffortVariant,
} from "../../open-sse/config/effortVariants.ts";

test("effort variants are disabled unless explicitly enabled", () => {
  for (const value of [undefined, "", "false", "0", "no", "unexpected"]) {
    assert.equal(isEffortVariantsEnabled(value), false, String(value));
  }
  for (const value of ["true", "1", "yes", " YES "]) {
    assert.equal(isEffortVariantsEnabled(value), true, value);
  }
});

test("generic effort expansion derives aliases from model metadata", () => {
  const models = [
    {
      id: "provider/model-a",
      root: "model-a",
      name: "Model A",
      supportedThinkingEfforts: ["none", "low", "high", "ultra"],
    },
  ];

  const expanded = appendEffortVariants(models);

  assert.deepEqual(
    expanded.map((model) => model.id),
    ["provider/model-a", "provider/model-a-low", "provider/model-a-high", "provider/model-a-ultra"]
  );
  assert.equal(expanded[1].root, "model-a-low");
  assert.equal(expanded[1].name, "Model A (Low)");
});

test("generic effort expansion reads catalog capability tiers and avoids collisions", () => {
  const base = {
    id: "provider/model-b",
    root: "model-b",
    capabilities: { effort_tiers: ["low", "high"] },
  };
  const existingHigh = { id: "provider/model-b-high", root: "model-b-high" };

  const expanded = appendEffortVariants([base, existingHigh]);

  assert.deepEqual(
    expanded.map((model) => model.id),
    ["provider/model-b", "provider/model-b-high", "provider/model-b-low"]
  );
});

test("known effort resolution requires a matching base model and declared tier", () => {
  const models = [
    {
      id: "model-a",
      supportedThinkingEfforts: ["low", "high"],
    },
  ];

  assert.deepEqual(resolveKnownEffortVariant("model-a-high", models), {
    baseModel: "model-a",
    effort: "high",
  });
  assert.deepEqual(resolveKnownEffortVariant("model-a-ultra", models), {
    baseModel: "model-a-ultra",
    effort: null,
  });
  assert.deepEqual(resolveKnownEffortVariant("unregistered-high", models), {
    baseModel: "unregistered-high",
    effort: null,
  });
});
