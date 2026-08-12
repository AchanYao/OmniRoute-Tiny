import { test, after } from "node:test";
import assert from "node:assert/strict";
import { applyCatalogPostFilters } from "../../src/app/api/v1/models/catalogResponse.ts";
import {
  removeFeatureFlagOverride,
  setFeatureFlagOverride,
} from "../../src/lib/db/featureFlags.ts";
import { setFunctionalGatewayProviderSetting } from "../../src/lib/db/functionalGatewayMirrors.ts";
import { resetDbInstance } from "../../src/lib/db/core.ts";

const FLAG_KEY = "EXPOSE_FUNCTIONAL_GATEWAY_MIRRORS";

after(() => {
  removeFeatureFlagOverride(FLAG_KEY);
  setFunctionalGatewayProviderSetting("agentrouter", null);
  resetDbInstance();
});

// Minimal Request shim for applyCatalogPostFilters.
function makeRequest(query = ""): Request {
  return new Request(`http://localhost/v1/models${query}`);
}

test("catalog post-filters do not add mirrors when gate off (default)", () => {
  const models = [
    { id: "deepseek/deepseek-v4-flash", owned_by: "deepseek", root: "deepseek-v4-flash" },
  ];
  const out = applyCatalogPostFilters(makeRequest(), models, {
    connections: [],
    prefixMode: "dual",
    aliasToProviderId: {},
  });
  assert.deepEqual(out, models);
});

test("catalog post-filters synthesize a gateway mirror when gate on and gateway has a connection", () => {
  setFeatureFlagOverride(FLAG_KEY, "true");
  setFunctionalGatewayProviderSetting("agentrouter", "on");

  const models = [
    { id: "deepseek/deepseek-v4-flash", owned_by: "deepseek", root: "deepseek-v4-flash" },
  ];
  const out = applyCatalogPostFilters(makeRequest(), models, {
    connections: [
      {
        id: "conn-1",
        provider: "agentrouter",
        isActive: true,
        providerSpecificData: {},
      },
    ],
    prefixMode: "dual",
    aliasToProviderId: {},
  });
  // The mirror pass is wired and synthesizes agentrouter/deepseek/deepseek-v4-flash
  // when the gate is on AND agentrouter (a passthrough gateway) has an active
  // connection covering the model.
  assert.ok(
    out.some((m) => m.id === "agentrouter/deepseek/deepseek-v4-flash"),
    `expected mirror to be synthesized, got: ${out.map((m) => m.id).join(", ")}`
  );
});

test("catalog post-filters expose one bare model for an exact id shared by providers", () => {
  const models = [
    {
      id: "openai/shared-model",
      object: "model",
      owned_by: "openai",
      root: "shared-model",
      context_length: 128_000,
    },
    {
      id: "anthropic/shared-model",
      object: "model",
      owned_by: "anthropic",
      root: "shared-model",
      context_length: 200_000,
    },
    {
      id: "openai/openai-only",
      object: "model",
      owned_by: "openai",
      root: "openai-only",
    },
  ];

  const out = applyCatalogPostFilters(makeRequest(), models, {
    connections: [],
    prefixMode: "dual",
    aliasToProviderId: {},
  });

  assert.deepEqual(
    out.map((model) => model.id),
    ["shared-model", "openai/openai-only"]
  );
  const aggregate = out[0];
  assert.equal(aggregate.owned_by, "aggregate");
  assert.equal(aggregate.root, "shared-model");
  assert.equal(aggregate.context_length, 128_000);
});

test("catalog post-filters keep near-match ids and same-provider aliases separate", () => {
  const models = [
    { id: "p1/model-v1", owned_by: "p1", root: "model-v1" },
    { id: "p2/model-v1-latest", owned_by: "p2", root: "model-v1-latest" },
    { id: "alias/model-v2", owned_by: "p3", root: "model-v2" },
    { id: "canonical/model-v2", owned_by: "p3", root: "model-v2" },
    { id: "p4/org/model-v3", owned_by: "p4", root: "org/model-v3" },
    { id: "p5/org/model-v3", owned_by: "p5", root: "org/model-v3" },
  ];

  const out = applyCatalogPostFilters(makeRequest(), models, {
    connections: [],
    prefixMode: "dual",
    aliasToProviderId: {},
  });

  assert.deepEqual(out, models);
});

test("catalog post-filters keep an explicit combo as the aggregate entry", () => {
  const models = [
    { id: "shared-model", owned_by: "combo", root: "shared-model" },
    { id: "openai/shared-model", owned_by: "openai", root: "shared-model" },
    { id: "anthropic/shared-model", owned_by: "anthropic", root: "shared-model" },
  ];

  const out = applyCatalogPostFilters(makeRequest(), models, {
    connections: [],
    prefixMode: "dual",
    aliasToProviderId: {},
  });

  assert.deepEqual(out, [models[0]]);
});
