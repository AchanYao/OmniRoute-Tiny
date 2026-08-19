import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-skills-route-"));
const originalDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = tmpDir;

const core = await import("../../src/lib/db/core.ts");
const { skillRegistry } = await import("../../src/lib/skills/registry.ts");
const skillsRoute = await import("../../src/app/api/skills/route.ts");
const skillByIdRoute = await import("../../src/app/api/skills/[id]/route.ts");

function clearSkillRegistry() {
  skillRegistry.registeredSkills?.clear?.();
  skillRegistry.versionCache?.clear?.();
  if (typeof skillRegistry.invalidateCache === "function") {
    skillRegistry.invalidateCache();
  }
}

function resetStorage() {
  core.resetDbInstance();
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });
  clearSkillRegistry();
  core.getDbInstance();
}

async function registerSkill(overrides = {}) {
  return skillRegistry.register({
    apiKeyId: "api-key-1",
    name: "lookupWeather",
    version: "1.0.0",
    description: "Weather lookup",
    schema: {
      input: {
        type: "object",
        properties: {
          location: { type: "string" },
        },
      },
      output: {
        type: "object",
      },
    },
    handler: "weather-handler",
    enabled: true,
    ...overrides,
  });
}

test.beforeEach(() => {
  resetStorage();
});

test.after(() => {
  core.resetDbInstance();
  clearSkillRegistry();
  process.env.DATA_DIR = originalDataDir;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("skills route GET loads skills from the database and lists them", async () => {
  const created = await registerSkill();

  clearSkillRegistry();

  const response = await skillsRoute.GET(
    new Request("http://localhost/api/skills?page=1&limit=50")
  );
  const body = (await response.json()) as any;

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(body.data));
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].id, created.id);
  assert.equal(body.data[0].name, "lookupWeather");
});

test("skills route GET returns 500 when the registry load fails", async () => {
  const originalLoadFromDatabase = skillRegistry.loadFromDatabase;
  skillRegistry.loadFromDatabase = async () => {
    throw new Error("skill db unavailable");
  };

  try {
    const response = await skillsRoute.GET(
      new Request("http://localhost/api/skills?page=1&limit=50")
    );
    const body = (await response.json()) as any;

    assert.equal(response.status, 500);
    assert.equal(body.error, "skill db unavailable");
  } finally {
    skillRegistry.loadFromDatabase = originalLoadFromDatabase;
  }
});
