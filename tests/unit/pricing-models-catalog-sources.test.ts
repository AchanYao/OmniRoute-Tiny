import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, test } from "node:test";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-pricing-models-catalog-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../src/lib/db/core.ts");
const modelsDb = await import("../../src/lib/db/models.ts");
const pricingRoute = await import("../../src/app/api/pricing/models/route.ts");

type CatalogModel = { id: string; name?: string };
type CatalogProvider = { id: string; alias?: string; models: CatalogModel[] };

async function resetStorage() {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

beforeEach(async () => {
  await resetStorage();
});

after(() => {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

function collectTargets(catalog: Record<string, CatalogProvider>): string[] {
  return Object.values(catalog).flatMap((provider) =>
    (provider.models || []).map((model) => `${provider.id}/${model.id}`)
  );
}

test("pricing catalog includes registry, custom, and synced models as override targets", async () => {
  await modelsDb.addCustomModel("openai", "manual-override-target", "Manual Override Target");
  await modelsDb.replaceSyncedAvailableModelsForConnection("openai", "conn-catalog", [
    { id: "synced-override-target", name: "Synced Override Target" },
  ]);

  const response = await pricingRoute.GET();
  assert.equal(response.status, 200);

  const catalog = (await response.json()) as Record<string, CatalogProvider>;
  const targets = collectTargets(catalog);

  assert.equal(targets.includes("openai/gpt-4o"), true, "registry model should be selectable");
  assert.equal(
    targets.includes("openai/manual-override-target"),
    true,
    "manually added model should be selectable"
  );
  assert.equal(
    targets.includes("openai/synced-override-target"),
    true,
    "upstream-synced model should be selectable"
  );
});
