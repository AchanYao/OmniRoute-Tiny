import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { gatewayBuildAliasesFor } from "../../scripts/build/gatewayBuildAliases.mjs";

describe("Gateway build aliases", () => {
  it("does not replace modules in Full builds", () => {
    assert.deepEqual(gatewayBuildAliasesFor({ OMNIROUTE_BUILD_PROFILE: "full" }), {});
  });

  it("replaces optional platform loaders in Gateway builds", () => {
    assert.deepEqual(gatewayBuildAliasesFor({ OMNIROUTE_BUILD_PROFILE: "gateway" }), {
      "@/lib/memory/extraction": "./src/lib/build-profile/disabledModule.stub.ts",
      "@/lib/memory/index": "./src/lib/build-profile/disabledModule.stub.ts",
      "@/lib/memory/injection": "./src/lib/build-profile/disabledModule.stub.ts",
      "@/lib/memory/retrieval": "./src/lib/build-profile/disabledModule.stub.ts",
      "@/lib/memory/settings": "./src/lib/build-profile/disabledModule.stub.ts",
      "@/lib/memory/typedDecay": "./src/lib/build-profile/disabledModule.stub.ts",
      "@/lib/plugins/hooks": "./src/lib/build-profile/disabledModule.stub.ts",
      "@/lib/plugins/manager": "./src/lib/build-profile/disabledModule.stub.ts",
      "@/lib/skills/builtins": "./src/lib/build-profile/disabledModule.stub.ts",
      "@/lib/skills/executor": "./src/lib/build-profile/disabledModule.stub.ts",
      "@/lib/skills/injection": "./src/lib/build-profile/disabledModule.stub.ts",
      "@/lib/skills/interception": "./src/lib/build-profile/disabledModule.stub.ts",
      "@omniroute/open-sse/mcp-server/audit.ts": "./src/lib/build-profile/disabledModule.stub.ts",
    });
  });
});
