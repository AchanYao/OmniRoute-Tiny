#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  GATEWAY_EXCLUDED_ROUTE_PREFIXES,
  GATEWAY_EXCLUDED_STANDALONE_DIRECTORY_SUFFIXES,
  GATEWAY_EXCLUDED_STANDALONE_FILE_SUFFIXES,
} from "../build/gatewayEdition.mjs";

function normalizeRelativePath(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function matchesSuffix(relativePath, suffixes) {
  const normalized = normalizeRelativePath(relativePath);
  return suffixes.some((suffix) => normalized === suffix || normalized.endsWith(`/${suffix}`));
}

async function walkArtifact(directory, root, fsImpl, violations) {
  const entries = await fsImpl.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const targetPath = path.join(directory, entry.name);
    const relativePath = path.relative(root, targetPath);

    if (entry.isDirectory()) {
      if (matchesSuffix(relativePath, GATEWAY_EXCLUDED_STANDALONE_DIRECTORY_SUFFIXES)) {
        violations.push(normalizeRelativePath(relativePath));
        continue;
      }
      await walkArtifact(targetPath, root, fsImpl, violations);
      continue;
    }

    if (entry.isFile()) {
      if (matchesSuffix(relativePath, GATEWAY_EXCLUDED_STANDALONE_FILE_SUFFIXES)) {
        violations.push(normalizeRelativePath(relativePath));
      }
      if (entry.name === "app-paths-manifest.json") {
        const manifest = JSON.parse(await fsImpl.readFile(targetPath, "utf8"));
        for (const route of Object.keys(manifest)) {
          if (
            GATEWAY_EXCLUDED_ROUTE_PREFIXES.some(
              (prefix) => route === prefix || route.startsWith(`${prefix}/`)
            )
          ) {
            violations.push(`${normalizeRelativePath(relativePath)} -> ${route}`);
          }
        }
      }
    }
  }
}

export async function findGatewayArtifactViolations(rootDir, fsImpl = fs) {
  const root = path.resolve(rootDir);
  const stats = await fsImpl.stat(root);
  if (!stats.isDirectory()) {
    throw new Error(`Gateway artifact root is not a directory: ${root}`);
  }

  const violations = [];
  await walkArtifact(root, root, fsImpl, violations);
  return violations.sort();
}

async function main() {
  const rootDir = process.argv[2];
  if (!rootDir) {
    console.error("Usage: npm run check:gateway-artifact -- <standalone-root>");
    process.exitCode = 2;
    return;
  }

  const violations = await findGatewayArtifactViolations(rootDir);
  if (violations.length > 0) {
    console.error("Gateway artifact contains excluded paths:");
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
    return;
  }

  console.log("Gateway artifact path audit passed");
}

const entryScript = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (entryScript === import.meta.url) {
  await main();
}
