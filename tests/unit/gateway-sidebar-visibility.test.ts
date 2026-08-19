import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getGatewayHiddenSidebarItems,
  HIDEABLE_SIDEBAR_ITEM_IDS,
} from "../../src/shared/constants/sidebarVisibility.ts";

describe("Gateway Edition sidebar visibility", () => {
  it("keeps the aggregation gateway destinations visible", () => {
    const hidden = new Set(getGatewayHiddenSidebarItems("gateway", []));
    const retained = [
      "home",
      "endpoints",
      "api-manager",
      "providers",
      "combos",
      "quota",
      "analytics",
      "costs",
      "logs",
      "health",
      "translator",
      "playground",
      "batch",
      "settings-routing",
      "settings-resilience",
      "settings-security",
      "settings-model-overrides",
    ];

    for (const item of retained) {
      assert.equal(hidden.has(item), false, `${item} should remain visible`);
    }
  });

  it("hides agent-platform and prompt-compression destinations", () => {
    const hidden = new Set(getGatewayHiddenSidebarItems("gateway", []));
    const excluded = [
      "context-settings",
      "context-rtk",
      "compression-studio",
      "cli-agents",
      "acp-agents",
      "cloud-agents",
      "analytics-compression",
      "analytics-search",
      "analytics-evals",
      "audit-mcp",
      "audit-a2a",
      "search-tools",
      "memory",
      "skills",
      "agent-skills",
      "chaos-config",
      "mcp",
      "a2a",
      "plugins",
      "leaderboard",
      "profile",
      "tokens",
      "settings-ai",
    ];

    for (const item of excluded) {
      assert.equal(hidden.has(item), true, `${item} should be hidden`);
    }
  });

  it("merges user choices without persisting a generated Gateway list", () => {
    const userHidden = ["logs", "providers"];
    const gatewayHidden = getGatewayHiddenSidebarItems("gateway", userHidden);

    assert.equal(gatewayHidden.includes("logs"), true);
    assert.equal(gatewayHidden.includes("providers"), true);
    assert.equal(gatewayHidden.includes("mcp"), true);
    assert.deepEqual(getGatewayHiddenSidebarItems("full", userHidden), ["providers", "logs"]);
    assert.deepEqual(userHidden, ["logs", "providers"]);
    assert.equal(gatewayHidden.length <= HIDEABLE_SIDEBAR_ITEM_IDS.length, true);
  });
});
