/**
 * OAuth create must fire connection-scoped model import; re-auth must not.
 *
 * API-key POST /api/providers already fire-and-forgets
 * /sync-models?mode=import. persistOAuthConnection did not, so a newly added
 * Antigravity (or Cursor) account had no syncedAvailableModels row. /v1/models
 * then fell back to the static registry and hid live ids such as
 * gemini-3.7-flash-tiered when the previously imported account was inactive.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-oauth-auto-import-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../src/lib/db/core.ts");
const { persistOAuthConnection } = await import("../../src/lib/oauth/connectionPersistence.ts");

type FetchCall = { url: string; method: string; redirect?: RequestRedirect };

const fetchCalls: FetchCall[] = [];
const originalFetch = globalThis.fetch;

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" || input instanceof URL ? String(input) : input.url;
  fetchCalls.push({
    url,
    method: init?.method || "GET",
    ...(init?.redirect ? { redirect: init.redirect } : {}),
  });
  return new Response(JSON.stringify({ syncedModels: 1 }), { status: 200 });
}) as typeof fetch;

async function resetStorage() {
  core.resetDbInstance();
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      if (fs.existsSync(TEST_DATA_DIR)) {
        fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
      }
      break;
    } catch (error: unknown) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if ((code === "EBUSY" || code === "EPERM") && attempt < 9) {
        await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
      } else {
        throw error;
      }
    }
  }
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  fetchCalls.length = 0;
}

test.beforeEach(async () => {
  await resetStorage();
});
test.after(async () => {
  globalThis.fetch = originalFetch;
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

function importCallsFor(connectionId: string): FetchCall[] {
  const encodedId = encodeURIComponent(connectionId);
  return fetchCalls.filter(
    (call) =>
      call.method === "POST" &&
      call.url.includes(`/api/providers/${encodedId}/sync-models`) &&
      call.url.includes("mode=import")
  );
}

async function flushImport(): Promise<void> {
  await Promise.resolve();
}

test("persistOAuthConnection imports models after creating a connection", async () => {
  const connection = await persistOAuthConnection("antigravity", {
    email: "new@example.com",
    accessToken: "token-new",
    refreshToken: "refresh-new",
    expiresIn: 3600,
  });

  await flushImport();
  const imports = importCallsFor(connection.id);
  assert.equal(imports.length, 1, "new OAuth connections must trigger one model import");
  assert.equal(
    imports[0]?.redirect,
    "error",
    "credential-bearing import fetch must reject redirects"
  );
});

test("persistOAuthConnection does not re-import on token refresh / re-auth", async () => {
  const first = await persistOAuthConnection("antigravity", {
    email: "same@example.com",
    accessToken: "token-first",
    refreshToken: "refresh-first",
    expiresIn: 3600,
  });
  await flushImport();
  assert.equal(importCallsFor(first.id).length, 1);

  const second = await persistOAuthConnection("antigravity", {
    email: "same@example.com",
    accessToken: "token-second",
    refreshToken: "refresh-second",
    expiresIn: 3600,
  });

  await flushImport();
  assert.equal(second.id, first.id, "re-auth of the same account must update the existing row");
  assert.equal(
    importCallsFor(first.id).length,
    1,
    "refresh / re-auth must not fire another model import"
  );
});
