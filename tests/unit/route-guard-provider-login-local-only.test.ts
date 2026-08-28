/**
 * Security regression (#3292): POST /api/providers/[id]/login is classified
 * LOCAL_ONLY so loopback enforcement runs before any auth check. Cookie
 * Playwright login is gone; the path pattern remains so leftover clients
 * cannot spawn a browser. Hard Rules #15 + #17.
 *
 * The login segment sits AFTER the dynamic `[id]` param, so it is matched by a
 * regex in LOCAL_ONLY_API_PATTERNS rather than a flat prefix — classifying the
 * whole `/api/providers/` subtree as LOCAL_ONLY would wrongly lock the remote
 * dashboard out of ordinary provider CRUD. These tests pin BOTH the gate AND the
 * narrowness (no over-match).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { isLocalOnlyPath } from "../../src/server/authz/routeGuard.ts";

test("/api/providers/[id]/login is LOCAL_ONLY", () => {
  assert.equal(isLocalOnlyPath("/api/providers/claude/login"), true);
  assert.equal(isLocalOnlyPath("/api/providers/abc-123/login"), true);
});

test("/api/providers/[id]/login with a trailing slash is LOCAL_ONLY", () => {
  assert.equal(isLocalOnlyPath("/api/providers/claude/login/"), true);
});

test("the provider-login gate does NOT over-match the rest of /api/providers", () => {
  // Ordinary provider management must stay remotely reachable.
  assert.equal(isLocalOnlyPath("/api/providers"), false);
  assert.equal(isLocalOnlyPath("/api/providers/"), false);
  assert.equal(isLocalOnlyPath("/api/providers/claude"), false);
  assert.equal(isLocalOnlyPath("/api/providers/claude/test"), false);
  assert.equal(isLocalOnlyPath("/api/providers/claude/models"), false);
  // Anchored: extra segments after /login are not the spawn route.
  assert.equal(isLocalOnlyPath("/api/providers/claude/login/extra"), false);
  // "login" must be its own segment, not a substring of the id.
  assert.equal(isLocalOnlyPath("/api/providers/login-helper/status"), false);
});
