import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getBuildCapabilities } from "../../src/shared/constants/buildProfile.ts";
import { runOptionalPlatformStartup } from "../../src/lib/build-profile/runOptionalPlatformStartup.ts";

describe("optional platform startup", () => {
  it("does not load Skills or Plugins in the Gateway Edition", async () => {
    const result = await runOptionalPlatformStartup(getBuildCapabilities("gateway"), {
      registerBuiltinSkills: () => {
        throw new Error("Gateway build loaded Skills");
      },
      loadPlugins: () => {
        throw new Error("Gateway build loaded Plugins");
      },
    });

    assert.deepEqual(result, { skills: "skipped", plugins: "skipped" });
  });

  it("starts Skills and Plugins in the Full build", async () => {
    let skillsStarted = 0;
    let pluginsStarted = 0;

    const result = await runOptionalPlatformStartup(getBuildCapabilities("full"), {
      registerBuiltinSkills: () => {
        skillsStarted += 1;
      },
      loadPlugins: async () => {
        pluginsStarted += 1;
      },
    });

    assert.deepEqual(result, { skills: "started", plugins: "started" });
    assert.equal(skillsStarted, 1);
    assert.equal(pluginsStarted, 1);
  });
});
