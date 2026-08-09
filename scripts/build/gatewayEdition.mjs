import fs from "node:fs/promises";
import path from "node:path";

export const GATEWAY_EXCLUDED_APP_PATHS = Object.freeze([
  "src/app/.well-known/agent.json",
  "src/app/a2a",
  "src/app/api/a2a",
  "src/app/api/acp",
  "src/app/api/agent-skills",
  "src/app/api/analytics/compression",
  "src/app/api/assess",
  "src/app/api/chaos",
  "src/app/api/cli-tools",
  "src/app/api/compression",
  "src/app/api/context",
  "src/app/api/evals",
  "src/app/api/gamification",
  "src/app/api/github-skills",
  "src/app/api/issue-agent",
  "src/app/api/mcp",
  "src/app/api/memory",
  "src/app/api/plugins",
  "src/app/api/search",
  "src/app/api/settings/compression",
  "src/app/api/settings/local-corpus",
  "src/app/api/settings/memory",
  "src/app/api/settings/notion",
  "src/app/api/settings/obsidian",
  "src/app/api/settings/qdrant",
  "src/app/api/skills",
  "src/app/api/tools/agent-bridge",
  "src/app/api/vnc-session",
  "src/app/api/v1/agents",
  "src/app/api/v1/search",
  "src/app/(dashboard)/dashboard/a2a",
  "src/app/(dashboard)/dashboard/acp-agents",
  "src/app/(dashboard)/dashboard/agent-skills",
  "src/app/(dashboard)/dashboard/analytics/compression",
  "src/app/(dashboard)/dashboard/analytics/evals",
  "src/app/(dashboard)/dashboard/analytics/search",
  "src/app/(dashboard)/dashboard/audit/a2a",
  "src/app/(dashboard)/dashboard/audit/mcp",
  "src/app/(dashboard)/dashboard/chaos",
  "src/app/(dashboard)/dashboard/cli-agents",
  "src/app/(dashboard)/dashboard/cli-code",
  "src/app/(dashboard)/dashboard/cloud-agents",
  "src/app/(dashboard)/dashboard/compression",
  "src/app/(dashboard)/dashboard/context",
  "src/app/(dashboard)/dashboard/gamification",
  "src/app/(dashboard)/dashboard/leaderboard",
  "src/app/(dashboard)/dashboard/mcp",
  "src/app/(dashboard)/dashboard/memory",
  "src/app/(dashboard)/dashboard/omni-skills",
  "src/app/(dashboard)/dashboard/plugins",
  "src/app/(dashboard)/dashboard/profile",
  "src/app/(dashboard)/dashboard/search-tools",
  "src/app/(dashboard)/dashboard/settings/ai",
  "src/app/(dashboard)/dashboard/tokens",
  "src/app/(dashboard)/dashboard/tools/agent-bridge",
]);

export const GATEWAY_EXCLUDED_STANDALONE_DIRECTORY_SUFFIXES = Object.freeze([
  "open-sse/mcp-server",
  "open-sse/services/compression",
  "src/lib/a2a",
  "src/lib/acp",
  "src/lib/agentSkills",
  "src/lib/chaos",
  "src/lib/cloudAgent",
  "src/lib/evals",
  "src/lib/gamification",
  "src/lib/issueAgent",
  "src/lib/localCorpus",
  "src/lib/memory",
  "src/lib/notion",
  "src/lib/obsidian",
  "src/lib/plugins",
  "src/lib/skills",
  "src/lib/vncSession",
  "node_modules/sqlite-vec",
  "node_modules/sqlite-vec-linux-x64",
  "node_modules/sqlite-vec-linux-arm64",
  "node_modules/sqlite-vec-darwin-x64",
  "node_modules/sqlite-vec-darwin-arm64",
  "node_modules/sqlite-vec-windows-x64",
  "node_modules/@atjsh/llmlingua-2",
  "node_modules/@huggingface/transformers",
  "node_modules/@tensorflow/tfjs",
  "node_modules/js-tiktoken",
]);

export const GATEWAY_EXCLUDED_STANDALONE_FILE_SUFFIXES = Object.freeze(["bin/mcp-server.mjs"]);

export const GATEWAY_EXCLUDED_ROUTE_PREFIXES = Object.freeze([
  "/.well-known/agent.json",
  "/a2a",
  "/api/v1/agents",
  "/api/v1/search",
  "/api/settings/local-corpus",
  "/api/settings/notion",
  "/api/settings/obsidian",
  "/(dashboard)/dashboard/analytics/evals",
  "/(dashboard)/dashboard/analytics/search",
  "/(dashboard)/dashboard/audit/a2a",
  "/(dashboard)/dashboard/profile",
  "/(dashboard)/dashboard/settings/ai",
  "/(dashboard)/dashboard/tokens",
]);

export function isGatewayEditionBuild(env = process.env) {
  return env.OMNIROUTE_BUILD_PROFILE?.trim().toLowerCase() === "gateway";
}

function validateRelativePath(relativePath) {
  if (
    typeof relativePath !== "string" ||
    relativePath.length === 0 ||
    path.isAbsolute(relativePath) ||
    relativePath.split(/[\\/]/).includes("..")
  ) {
    throw new Error(`Invalid Gateway Edition path: ${String(relativePath)}`);
  }
}

async function exists(targetPath, fsImpl) {
  try {
    await fsImpl.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function movePath(sourcePath, destinationPath, fsImpl) {
  await fsImpl.mkdir(path.dirname(destinationPath), { recursive: true });
  try {
    await fsImpl.rename(sourcePath, destinationPath);
  } catch (error) {
    if (error?.code !== "EXDEV") throw error;
    await fsImpl.cp(sourcePath, destinationPath, {
      recursive: true,
      preserveTimestamps: true,
      force: false,
      errorOnExist: true,
    });
    await fsImpl.rm(sourcePath, { recursive: true, force: true });
  }
}

export async function stageGatewayEdition(rootDir, backupRoot, fsImpl = fs, log = console) {
  const staged = [];
  for (const relativePath of GATEWAY_EXCLUDED_APP_PATHS) {
    validateRelativePath(relativePath);
    const sourcePath = path.join(rootDir, relativePath);
    if (!(await exists(sourcePath, fsImpl))) continue;

    const backupPath = path.join(backupRoot, relativePath);
    if (await exists(backupPath, fsImpl)) {
      throw new Error(`Gateway Edition backup path already exists: ${backupPath}`);
    }

    await movePath(sourcePath, backupPath, fsImpl);
    staged.push({ relativePath, sourcePath, backupPath });
  }
  log.log?.(`[gateway-build] Staged ${staged.length} excluded App Router path(s)`);
  return staged;
}

export async function restoreGatewayEdition(stagedPaths, fsImpl = fs, log = console) {
  const failures = [];
  let restored = 0;

  for (const entry of [...stagedPaths].reverse()) {
    try {
      if (await exists(entry.sourcePath, fsImpl)) {
        throw new Error(`Refusing to overwrite restored source path: ${entry.sourcePath}`);
      }
      await movePath(entry.backupPath, entry.sourcePath, fsImpl);
      restored += 1;
    } catch (error) {
      failures.push(error);
      log.error?.(`[gateway-build] Failed to restore ${entry.relativePath}: ${error?.message}`);
    }
  }

  log.log?.(`[gateway-build] Restored ${restored}/${stagedPaths.length} excluded path(s)`);
  if (failures.length > 0) {
    throw new AggregateError(failures, "Gateway Edition source restoration failed");
  }
}

function matchesSuffix(relativePath, suffixes) {
  const normalized = relativePath.split(path.sep).join("/");
  return suffixes.some(
    (excludedPath) => normalized === excludedPath || normalized.endsWith(`/${excludedPath}`)
  );
}

async function findExcludedPaths(directory, standaloneRoot, fsImpl, matches = []) {
  let entries;
  try {
    entries = await fsImpl.readdir(directory, { withFileTypes: true });
  } catch {
    return matches;
  }

  for (const entry of entries) {
    const childPath = path.join(directory, entry.name);
    const relativePath = path.relative(standaloneRoot, childPath);
    const excluded = entry.isDirectory()
      ? matchesSuffix(relativePath, [
          ...GATEWAY_EXCLUDED_APP_PATHS,
          ...GATEWAY_EXCLUDED_STANDALONE_DIRECTORY_SUFFIXES,
        ])
      : entry.isFile() && matchesSuffix(relativePath, GATEWAY_EXCLUDED_STANDALONE_FILE_SUFFIXES);
    if (excluded) {
      matches.push({ path: childPath, relativePath });
      continue;
    }
    if (entry.isDirectory()) {
      await findExcludedPaths(childPath, standaloneRoot, fsImpl, matches);
    }
  }
  return matches;
}

export async function pruneGatewayStandalone(rootDir, distDir, fsImpl = fs, log = console) {
  void rootDir;
  const standaloneRoot = path.join(distDir, "standalone");
  const matches = await findExcludedPaths(standaloneRoot, standaloneRoot, fsImpl);
  const pruned = [];

  for (const match of matches) {
    await fsImpl.rm(match.path, { recursive: true, force: true });
    pruned.push(match.relativePath.split(path.sep).join("/"));
  }

  pruned.sort();
  log.log?.(`[gateway-build] Pruned ${pruned.length} excluded standalone path(s)`);
  return pruned;
}
