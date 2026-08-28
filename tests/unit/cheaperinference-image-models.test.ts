// Cheaper Inference image models after Adobe Firefly image stub removal.
//
// nano-banana-pro / nano-banana-2 used to collide with adobe-firefly. That stub is gone,
// so bare ids must NOT resolve to adobe-firefly. Prefixed cheaperinference/cinf still resolve.
import { test } from "node:test";
import assert from "node:assert/strict";
import { IMAGE_PROVIDERS, parseImageModel } from "@omniroute/open-sse/config/imageRegistry.ts";

test("cheaperinference is registered as an image provider with the 3 measured models", () => {
  const provider = IMAGE_PROVIDERS.cheaperinference;
  assert.ok(provider, "cheaperinference missing from IMAGE_PROVIDERS");
  assert.equal(provider.baseUrl, "https://api.cheaperinference.com/v1/images/generations");
  assert.equal(provider.authType, "apikey");
  assert.equal(provider.authHeader, "bearer");
  assert.equal(provider.format, "openai");
  assert.equal(provider.alias, "cinf");
  const ids = provider.models.map((m) => m.id).sort();
  assert.deepEqual(ids, ["grok-imagine", "nano-banana-2", "nano-banana-pro"]);
});

test("prefixed ids resolve to cheaperinference", () => {
  assert.deepEqual(parseImageModel("cheaperinference/nano-banana-2"), {
    provider: "cheaperinference",
    model: "nano-banana-2",
  });
  assert.deepEqual(parseImageModel("cinf/grok-imagine"), {
    provider: "cheaperinference",
    model: "grok-imagine",
  });
});

test("bare nano-banana ids no longer resolve to adobe-firefly", () => {
  assert.equal("adobe-firefly" in IMAGE_PROVIDERS, false);
  assert.notEqual(parseImageModel("nano-banana-2").provider, "adobe-firefly");
  assert.notEqual(parseImageModel("nano-banana-pro").provider, "adobe-firefly");
  // After Firefly removal the bare ids belong to cheaperinference first-match.
  assert.equal(parseImageModel("nano-banana-2").provider, "cheaperinference");
  assert.equal(parseImageModel("nano-banana-pro").provider, "cheaperinference");
});

test("cheaperinference image models are NOT in the chat registry", async () => {
  const { REGISTRY } = await import("@omniroute/open-sse/config/providers/index.ts");
  const chatIds = new Set(
    (REGISTRY.cheaperinference as unknown as { models: Array<{ id: string }> }).models.map(
      (m) => m.id
    )
  );
  // Upstream returns HTTP 400 for these on /v1/chat/completions:
  // "…is an image-generation model. Use POST /v1/images/generations."
  for (const id of ["grok-imagine", "nano-banana-2", "nano-banana-pro"]) {
    assert.ok(!chatIds.has(id), `${id} must not be routable as a chat model`);
  }
});
