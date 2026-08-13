import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Docker builds default to the Gateway profile and permit explicit overrides", () => {
  const dockerfile = fs.readFileSync("Dockerfile", "utf8");
  const colocateStandalone = fs.readFileSync("scripts/build/colocate-standalone.mjs", "utf8");

  assert.match(dockerfile, /ARG OMNIROUTE_BUILD_PROFILE=gateway/);
  assert.match(dockerfile, /ENV OMNIROUTE_BUILD_PROFILE=\$\{OMNIROUTE_BUILD_PROFILE\}/);
  assert.match(
    dockerfile,
    /if \[ "\$OMNIROUTE_BUILD_PROFILE" = "gateway" \]; then npm run check:gateway-artifact/
  );

  const profileArg = dockerfile.indexOf("ARG OMNIROUTE_BUILD_PROFILE=gateway");
  const productionBuild = dockerfile.indexOf("npm run build");
  assert.ok(profileArg >= 0 && profileArg < productionBuild);

  assert.match(colocateStandalone, /isGatewayEditionBuild\(process\.env\)/);
  assert.match(colocateStandalone, /Gateway Edition skips LLMLingua colocation/);
});
