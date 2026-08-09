import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getBuildCapabilities,
  isGatewayBuild,
  resolveBuildProfile,
} from "../../src/shared/constants/buildProfile.ts";

describe("build profile capabilities", () => {
  it("defaults missing and unknown profiles to full", () => {
    assert.equal(resolveBuildProfile({}), "full");
    assert.equal(resolveBuildProfile({ OMNIROUTE_BUILD_PROFILE: "unknown" }), "full");
  });

  it("preserves each supported build profile", () => {
    assert.equal(resolveBuildProfile({ OMNIROUTE_BUILD_PROFILE: "full" }), "full");
    assert.equal(resolveBuildProfile({ OMNIROUTE_BUILD_PROFILE: "minimal" }), "minimal");
    assert.equal(resolveBuildProfile({ OMNIROUTE_BUILD_PROFILE: "backend" }), "backend");
    assert.equal(resolveBuildProfile({ OMNIROUTE_BUILD_PROFILE: "gateway" }), "gateway");
  });

  it("uses the build-injected public profile when the runtime variable is absent", () => {
    assert.equal(
      resolveBuildProfile({ NEXT_PUBLIC_OMNIROUTE_BUILD_PROFILE: "gateway" }),
      "gateway"
    );
  });

  it("keeps platform capabilities enabled outside the gateway edition", () => {
    const capabilities = getBuildCapabilities("full");

    assert.deepEqual(capabilities, {
      gateway: true,
      mcp: true,
      skills: true,
      memory: true,
      promptCompression: true,
      agentProtocols: true,
      plugins: true,
      dashboardExtensions: true,
    });
  });

  it("disables every extension capability in the gateway edition", () => {
    const capabilities = getBuildCapabilities("gateway");

    assert.deepEqual(capabilities, {
      gateway: true,
      mcp: false,
      skills: false,
      memory: false,
      promptCompression: false,
      agentProtocols: false,
      plugins: false,
      dashboardExtensions: false,
    });
    assert.equal(isGatewayBuild({ OMNIROUTE_BUILD_PROFILE: "gateway" }), true);
    assert.equal(isGatewayBuild({ OMNIROUTE_BUILD_PROFILE: "minimal" }), false);
  });
});
