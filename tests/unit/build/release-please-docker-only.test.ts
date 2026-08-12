import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";

const root = process.cwd();
const workflows = path.join(root, ".github", "workflows");

test("Release Please owns version tags and GitHub releases on main", () => {
  const workflow = yaml.load(
    fs.readFileSync(path.join(workflows, "release-please.yml"), "utf8")
  ) as Record<string, unknown>;
  const raw = fs.readFileSync(path.join(workflows, "release-please.yml"), "utf8");
  assert.ok(workflow.jobs, "release-please workflow must define a job");
  assert.match(raw, /branches:\s*\n\s+- main/);
  assert.match(raw, /googleapis\/release-please-action@[0-9a-f]{40}/);
  assert.match(raw, /RELEASE_PLEASE_TOKEN/);
});

test("release manifest starts from the current application version", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, ".release-please-manifest.json"), "utf8")
  );
  const config = JSON.parse(fs.readFileSync(path.join(root, "release-please-config.json"), "utf8"));

  assert.equal(manifest["."], pkg.version);
  assert.equal(config.packages["."]["package-name"], "omniroute");
  assert.deepEqual(config.packages["."]["extra-files"], [
    "electron/package.json",
    "electron/package-lock.json",
    "open-sse/package.json",
  ]);
});

test("legacy npm, VPS, and release-branch authority workflows are absent", () => {
  for (const file of ["npm-publish.yml", "deploy-vps.yml", "lock-released-branch.yml"]) {
    assert.equal(fs.existsSync(path.join(workflows, file)), false, `${file} must be removed`);
  }
});
