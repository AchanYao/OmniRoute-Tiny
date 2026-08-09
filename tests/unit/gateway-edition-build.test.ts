import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  isGatewayEditionBuild,
  pruneGatewayStandalone,
  restoreGatewayEdition,
  stageGatewayEdition,
} from "../../scripts/build/gatewayEdition.mjs";
import { assembleStandalone } from "../../scripts/build/assembleStandalone.mjs";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))
  );
});

async function createFixture(): Promise<{ root: string; backup: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "omniroute-gateway-build-"));
  const backup = await fs.mkdtemp(path.join(os.tmpdir(), "omniroute-gateway-backup-"));
  temporaryRoots.push(root, backup);

  await fs.mkdir(path.join(root, "src/app/api/v1/chat/completions"), { recursive: true });
  await fs.writeFile(path.join(root, "src/app/api/v1/chat/completions/route.ts"), "retained-api");
  await fs.mkdir(path.join(root, "src/app/api/mcp/status"), { recursive: true });
  await fs.writeFile(path.join(root, "src/app/api/mcp/status/route.ts"), "excluded-api");
  await fs.mkdir(path.join(root, "src/app/api/settings/qdrant"), { recursive: true });
  await fs.writeFile(path.join(root, "src/app/api/settings/qdrant/route.ts"), "excluded-qdrant");
  await fs.mkdir(path.join(root, "src/app/api/tools/agent-bridge"), { recursive: true });
  await fs.writeFile(
    path.join(root, "src/app/api/tools/agent-bridge/route.ts"),
    "excluded-agent-bridge"
  );
  await fs.mkdir(path.join(root, "src/app/.well-known/agent.json"), { recursive: true });
  await fs.writeFile(
    path.join(root, "src/app/.well-known/agent.json/route.ts"),
    "excluded-agent-card"
  );
  await fs.mkdir(path.join(root, "src/app/api/v1/agents/tasks"), { recursive: true });
  await fs.writeFile(path.join(root, "src/app/api/v1/agents/tasks/route.ts"), "excluded-agent-api");
  await fs.mkdir(path.join(root, "src/app/(dashboard)/dashboard/providers"), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(root, "src/app/(dashboard)/dashboard/providers/page.tsx"),
    "retained-dashboard"
  );
  await fs.mkdir(path.join(root, "src/app/(dashboard)/dashboard/compression"), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(root, "src/app/(dashboard)/dashboard/compression/page.tsx"),
    "excluded-dashboard"
  );

  return { root, backup };
}

describe("Gateway Edition build lifecycle", () => {
  it("recognizes only the gateway build profile", () => {
    assert.equal(isGatewayEditionBuild({ OMNIROUTE_BUILD_PROFILE: "gateway" }), true);
    assert.equal(isGatewayEditionBuild({ OMNIROUTE_BUILD_PROFILE: "minimal" }), false);
    assert.equal(isGatewayEditionBuild({}), false);
  });

  it("stages excluded routes and restores their original bytes", async () => {
    const { root, backup } = await createFixture();

    const staged = await stageGatewayEdition(root, backup);

    await assert.rejects(fs.access(path.join(root, "src/app/api/mcp/status/route.ts")));
    await assert.rejects(fs.access(path.join(root, "src/app/api/settings/qdrant/route.ts")));
    await assert.rejects(fs.access(path.join(root, "src/app/api/tools/agent-bridge/route.ts")));
    await assert.rejects(fs.access(path.join(root, "src/app/.well-known/agent.json/route.ts")));
    await assert.rejects(fs.access(path.join(root, "src/app/api/v1/agents/tasks/route.ts")));
    await assert.rejects(
      fs.access(path.join(root, "src/app/(dashboard)/dashboard/compression/page.tsx"))
    );
    assert.equal(
      await fs.readFile(path.join(root, "src/app/api/v1/chat/completions/route.ts"), "utf8"),
      "retained-api"
    );
    assert.equal(
      await fs.readFile(
        path.join(root, "src/app/(dashboard)/dashboard/providers/page.tsx"),
        "utf8"
      ),
      "retained-dashboard"
    );

    await restoreGatewayEdition(staged);

    assert.equal(
      await fs.readFile(path.join(root, "src/app/api/mcp/status/route.ts"), "utf8"),
      "excluded-api"
    );
    assert.equal(
      await fs.readFile(
        path.join(root, "src/app/(dashboard)/dashboard/compression/page.tsx"),
        "utf8"
      ),
      "excluded-dashboard"
    );
  });

  it("restores staged routes after a simulated build failure", async () => {
    const { root, backup } = await createFixture();
    const staged = await stageGatewayEdition(root, backup);

    try {
      throw new Error("simulated build failure");
    } catch {
      await restoreGatewayEdition(staged);
    }

    assert.equal(
      await fs.readFile(path.join(root, "src/app/api/mcp/status/route.ts"), "utf8"),
      "excluded-api"
    );
  });

  it("prunes excluded roots from standalone output only", async () => {
    const { root } = await createFixture();
    const distDir = path.join(root, ".build/next");
    const standaloneRoot = path.join(distDir, "standalone/project");
    await fs.mkdir(path.join(standaloneRoot, "src/app/api/mcp"), { recursive: true });
    await fs.writeFile(path.join(standaloneRoot, "src/app/api/mcp/route.js"), "excluded");
    await fs.mkdir(path.join(standaloneRoot, "src/app/api/v1"), { recursive: true });
    await fs.writeFile(path.join(standaloneRoot, "src/app/api/v1/route.js"), "retained");
    await fs.mkdir(path.join(standaloneRoot, "open-sse/mcp-server"), {
      recursive: true,
    });
    await fs.writeFile(path.join(standaloneRoot, "open-sse/mcp-server/server.js"), "excluded");
    await fs.mkdir(path.join(standaloneRoot, "src/lib/memory"), { recursive: true });
    await fs.writeFile(path.join(standaloneRoot, "src/lib/memory/index.js"), "excluded");
    await fs.mkdir(path.join(standaloneRoot, "bin"), { recursive: true });
    await fs.writeFile(path.join(standaloneRoot, "bin/mcp-server.mjs"), "excluded");
    await fs.mkdir(path.join(standaloneRoot, "node_modules/sqlite-vec"), { recursive: true });
    await fs.writeFile(path.join(standaloneRoot, "node_modules/sqlite-vec/index.js"), "excluded");

    const pruned = await pruneGatewayStandalone(root, distDir);

    assert.deepEqual(pruned, [
      "project/bin/mcp-server.mjs",
      "project/node_modules/sqlite-vec",
      "project/open-sse/mcp-server",
      "project/src/app/api/mcp",
      "project/src/lib/memory",
    ]);
    await assert.rejects(fs.access(path.join(standaloneRoot, "src/app/api/mcp/route.js")));
    assert.equal(
      await fs.readFile(path.join(standaloneRoot, "src/app/api/v1/route.js"), "utf8"),
      "retained"
    );
  });

  it("does not copy MCP, Memory, or LLMLingua-only dependencies in Gateway assembly", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "omniroute-gateway-assembly-"));
    temporaryRoots.push(root);
    const distDir = path.join(root, ".build/next");
    const standaloneRoot = path.join(distDir, "standalone");
    await fs.mkdir(standaloneRoot, { recursive: true });
    await fs.writeFile(path.join(standaloneRoot, "server.js"), "// server");

    for (const packageName of [
      "undici",
      "sqlite-vec",
      "sqlite-vec-darwin-arm64",
      "@atjsh/llmlingua-2",
    ]) {
      const packageRoot = path.join(root, "node_modules", packageName);
      await fs.mkdir(packageRoot, { recursive: true });
      await fs.writeFile(
        path.join(packageRoot, "package.json"),
        JSON.stringify({ name: packageName })
      );
    }

    assembleStandalone({
      distDir,
      outDir: standaloneRoot,
      projectRoot: root,
      copyNatives: true,
      includeAgentPlatform: false,
    });

    for (const packageName of [
      "undici",
      "sqlite-vec",
      "sqlite-vec-darwin-arm64",
      "@atjsh/llmlingua-2",
    ]) {
      await assert.rejects(fs.access(path.join(standaloneRoot, "node_modules", packageName)));
    }
  });
});
