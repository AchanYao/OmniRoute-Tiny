import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { findGatewayArtifactViolations } from "../../scripts/check/check-gateway-artifact.mjs";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))
  );
});

async function createArtifactRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "omniroute-gateway-artifact-"));
  temporaryRoots.push(root);
  return root;
}

async function writeFixture(root: string, relativePath: string): Promise<void> {
  const target = path.join(root, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, "fixture");
}

describe("Gateway standalone artifact checker", () => {
  it("accepts an artifact containing only retained gateway paths", async () => {
    const root = await createArtifactRoot();
    await writeFixture(root, "project/src/app/api/v1/chat/completions/route.js");
    await writeFixture(root, "project/src/lib/providers/index.js");
    await writeFixture(root, "project/server.js");

    assert.deepEqual(await findGatewayArtifactViolations(root), []);
  });

  it("reports excluded platform and prompt-compression roots", async () => {
    const root = await createArtifactRoot();
    await writeFixture(root, "project/open-sse/mcp-server/server.js");
    await writeFixture(root, "project/open-sse/services/compression/strategySelector.js");
    await writeFixture(root, "project/src/lib/skills/index.js");
    await writeFixture(root, "project/src/lib/memory/retrieval.js");
    await writeFixture(root, "project/bin/mcp-server.mjs");
    await writeFixture(root, "project/node_modules/sqlite-vec/index.js");
    await writeFixture(root, "project/node_modules/@atjsh/llmlingua-2/index.js");
    await writeFixture(root, "project/.build/next/server/app-paths-manifest.json");
    await fs.writeFile(
      path.join(root, "project/.build/next/server/app-paths-manifest.json"),
      JSON.stringify({
        "/api/v1/chat/completions/route": "retained.js",
        "/.well-known/agent.json/route": "excluded.js",
        "/api/v1/agents/tasks/route": "excluded.js",
      })
    );

    assert.deepEqual(await findGatewayArtifactViolations(root), [
      "project/.build/next/server/app-paths-manifest.json -> /.well-known/agent.json/route",
      "project/.build/next/server/app-paths-manifest.json -> /api/v1/agents/tasks/route",
      "project/bin/mcp-server.mjs",
      "project/node_modules/@atjsh/llmlingua-2",
      "project/node_modules/sqlite-vec",
      "project/open-sse/mcp-server",
      "project/open-sse/services/compression",
      "project/src/lib/memory",
      "project/src/lib/skills",
    ]);
  });
});
