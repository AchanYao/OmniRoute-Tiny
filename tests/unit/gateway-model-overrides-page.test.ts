import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { GATEWAY_EXCLUDED_APP_PATHS } from "../../scripts/build/gatewayEdition.mjs";
import {
  getGatewayHiddenSidebarItems,
  getSectionItems,
  HIDEABLE_SIDEBAR_ITEM_IDS,
  SIDEBAR_SECTIONS,
} from "../../src/shared/constants/sidebarVisibility.ts";
import { readSrc, REPO_ROOT } from "../_helpers/readSrc";

const SIDEBAR_ITEM_ID = "settings-model-overrides";
const PAGE_HREF = "/dashboard/settings/model-overrides";
const PAGE_PATH = "src/app/(dashboard)/dashboard/settings/model-overrides/page.tsx";

test("standalone model overrides page exists and only mounts the overrides tab", () => {
  const page = readSrc(PAGE_PATH);

  assert.match(page, /ModelCapabilityOverridesTab/);
  assert.doesNotMatch(page, /MemorySkillsTab/);
  assert.doesNotMatch(page, /ModelsDevSyncTab/);
  assert.doesNotMatch(page, /ThinkingBudgetTab/);
  assert.doesNotMatch(page, /VisionBridgeSettingsTab/);
});

test("full AI settings page still mounts the overrides tab", () => {
  const aiPage = readSrc("src/app/(dashboard)/dashboard/settings/ai/page.tsx");

  assert.match(aiPage, /ModelCapabilityOverridesTab/);
  assert.match(aiPage, /MemorySkillsTab/);
});

test("overrides tab still loads the merged pricing catalog", () => {
  const tab = readSrc(
    "src/app/(dashboard)/dashboard/settings/components/ModelCapabilityOverridesTab.tsx"
  );

  assert.match(tab, /fetch\("\/api\/pricing\/models"\)/);
  assert.match(tab, /fetch\("\/api\/model-capability-overrides"\)/);
});

test("sidebar exposes a Gateway-retained model overrides destination", () => {
  const configuration = SIDEBAR_SECTIONS.find((section) => section.id === "configuration");
  assert.ok(configuration, "expected configuration sidebar section");

  const item = getSectionItems(configuration).find((candidate) => candidate.id === SIDEBAR_ITEM_ID);

  assert.ok(item, `expected ${SIDEBAR_ITEM_ID} in configuration`);
  assert.equal(item.href, PAGE_HREF);
  assert.equal((HIDEABLE_SIDEBAR_ITEM_IDS as readonly string[]).includes(SIDEBAR_ITEM_ID), true);

  const hidden = new Set(getGatewayHiddenSidebarItems("gateway", []));
  assert.equal(hidden.has(SIDEBAR_ITEM_ID), false, `${SIDEBAR_ITEM_ID} should remain visible`);
  assert.equal(hidden.has("settings-ai"), true, "settings-ai should stay hidden in Gateway");
});

test("Gateway Edition keeps the standalone overrides route", () => {
  assert.equal(existsSync(join(REPO_ROOT, PAGE_PATH)), true);
  assert.equal(
    (GATEWAY_EXCLUDED_APP_PATHS as readonly string[]).includes(
      "src/app/(dashboard)/dashboard/settings/model-overrides"
    ),
    false
  );
  assert.equal(
    (GATEWAY_EXCLUDED_APP_PATHS as readonly string[]).includes(
      "src/app/(dashboard)/dashboard/settings/ai"
    ),
    true
  );
});
