/**
 * Issue #2877 — a Codex-only bare gpt-5.5 Responses request must keep the canonical
 * model id so request-level reasoning parameters remain authoritative.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-gpt55-routing-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../src/lib/db/core.ts");
const providersDb = await import("../../src/lib/db/providers.ts");
const { resolveModelOrError } = await import("../../src/sse/handlers/chatHelpers.ts");

test.before(async () => {
  // Codex-only active account (no openai connection).
  await providersDb.createProviderConnection({
    provider: "codex",
    authType: "oauth",
    email: "codex@example.com",
    providerSpecificData: { workspaceId: "ws-1" },
  });
});

test.after(() => {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

test("#2877 Codex-only bare gpt-5.5 Responses request keeps the bare model id", async () => {
  const result = (await resolveModelOrError(
    "gpt-5.5",
    { input: [{ role: "user", content: [{ type: "input_text", text: "hi" }] }] },
    "/v1/responses",
    null
  )) as { provider?: string; model?: string };

  assert.equal(result.provider, "codex", "Codex-only account must reroute gpt-5.5 to codex");
  assert.equal(
    result.model,
    "gpt-5.5",
    "must NOT inject a -medium suffix (that would override a client reasoning.effort=xhigh)"
  );
});
