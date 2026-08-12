import assert from "node:assert/strict";
import test from "node:test";

import { aggregateExactSameIdModels } from "../../src/app/api/v1/models/catalogAggregation.ts";

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
