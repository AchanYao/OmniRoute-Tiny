/**
 * Provider alias uniqueness — no two provider IDs may share the same short alias.
 *
 * Before this guard, aliases collided in the registry and the LAST entry in
 * iteration order silently won, emitting a startup warning and shadowing a real
 * provider (e.g. "hc" → hackclub). This test pins both the global uniqueness
 * invariant and the official short-alias resolutions across BOTH alias sources
 * (open-sse registry + src/shared providers map).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { PROVIDER_ID_TO_ALIAS } from "../../open-sse/config/providerModels.ts";
import {
  resolveProviderId,
  getProviderAlias,
  APIKEY_PROVIDERS,
} from "../../src/shared/constants/providers.ts";

test("no two provider IDs share the same alias in the open-sse registry", () => {
  const aliasToIds = new Map<string, string[]>();
  for (const [id, alias] of Object.entries(PROVIDER_ID_TO_ALIAS)) {
    const ids = aliasToIds.get(alias) ?? [];
    ids.push(id);
    aliasToIds.set(alias, ids);
  }

  const collisions = [...aliasToIds.entries()].filter(([, ids]) => ids.length > 1);
  assert.deepEqual(
    collisions,
    [],
    `Alias collisions detected (each alias must map to exactly one provider id): ${collisions
      .map(([alias, ids]) => `"${alias}" → ${ids.join(", ")}`)
      .join("; ")}`
  );
});

test("official primary providers keep their short aliases", () => {
  assert.equal(PROVIDER_ID_TO_ALIAS.kimi, "kimi");
  assert.equal(PROVIDER_ID_TO_ALIAS.hackclub, "hc");
  assert.equal(PROVIDER_ID_TO_ALIAS["kimi-web"], undefined);
  assert.equal(PROVIDER_ID_TO_ALIAS.huggingchat, undefined);
  assert.equal(PROVIDER_ID_TO_ALIAS["qwen-web"], undefined);
  assert.equal(PROVIDER_ID_TO_ALIAS["hailuo-web"], undefined);
});

test("src/shared providers map resolves official aliases unambiguously", () => {
  assert.equal(resolveProviderId("kimi"), "kimi");
  assert.equal(resolveProviderId("hc"), "hackclub");
  assert.equal(getProviderAlias("kimi"), "kimi");
  assert.equal(getProviderAlias("hackclub"), "hc");
  assert.equal(resolveProviderId("minimax"), "minimax");
  assert.equal(resolveProviderId("minimax-cn"), "minimax-cn");
});

test("sunset website-session ids are not in the API-key catalog", () => {
  assert.equal("huggingchat" in APIKEY_PROVIDERS, false);
  assert.equal("kimi-web" in APIKEY_PROVIDERS, false);
  assert.equal("qwen-web" in APIKEY_PROVIDERS, false);
  assert.equal("hailuo-web" in APIKEY_PROVIDERS, false);
  assert.equal("hackclub" in APIKEY_PROVIDERS, true);
});
