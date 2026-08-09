import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8")
);
const vitestConfig = readFileSync(new URL("../../vitest.config.ts", import.meta.url), "utf8");
const vitestMcpConfig = readFileSync(
  new URL("../../vitest.mcp.config.ts", import.meta.url),
  "utf8"
);

test("local unit runners use bounded concurrency", () => {
  assert.match(packageJson.scripts.test, /--test-concurrency=4/);
  assert.doesNotMatch(packageJson.scripts.test, /--test-concurrency=(?:[5-9]|\d{2,})/);
  assert.match(packageJson.scripts["test:unit"], /--test-concurrency=4/);
  assert.doesNotMatch(packageJson.scripts["test:unit"], /--test-concurrency=(?:[5-9]|\d{2,})/);

  for (const config of [vitestConfig, vitestMcpConfig]) {
    assert.match(config, /maxWorkers: 4/);
    assert.match(config, /maxConcurrency: 4/);
  }
});

test("default unit scope keeps gateway coverage and drops dedicated excluded suites", () => {
  const unitScript = packageJson.scripts["test:unit"];

  for (const retainedArea of ["api", "auth", "combo", "db", "services"]) {
    assert.match(unitScript, new RegExp(`(?:^|[,/{])${retainedArea}(?:[,/}])`));
  }
  for (const excludedArea of ["compression", "gamification", "mcp", "memory"]) {
    assert.doesNotMatch(unitScript, new RegExp(`(?:^|[,/{])${excludedArea}(?:[,/}])`));
  }

  assert.doesNotMatch(vitestConfig, /src\/lib\/(?:memory|skills)\/__tests__/);
  assert.doesNotMatch(vitestMcpConfig, /open-sse\/mcp-server\/__tests__/);
  assert.doesNotMatch(vitestMcpConfig, /src\/lib\/memory\/__tests__/);
  assert.match(vitestMcpConfig, /open-sse\/services\/(?:autoCombo|combo)\/__tests__/);
});
