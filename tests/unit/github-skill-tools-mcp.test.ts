/**
 * Unit tests for the MCP tool handlers in open-sse/mcp-server/tools/githubSkillTools.ts:
 *
 * - omniroute_github_skills_search
 * - omniroute_github_skills_scan
 *
 * global.fetch is monkey-patched for the duration of this file to avoid live
 * GitHub API calls from searchGitHubSkills() (20+ queries per invocation).
 */
import test from "node:test";
import assert from "node:assert/strict";

const { githubSkillTools } = await import("../../open-sse/mcp-server/tools/githubSkillTools.ts");
const { GitHubSkillsSearchSchema, GitHubSkillsScanSchema } =
  await import("../../src/lib/skills/githubCollector.ts");

const originalFetch = globalThis.fetch;

test.before(() => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
});

test.after(() => {
  globalThis.fetch = originalFetch;
});

// ─── omniroute_github_skills_search ────────────────────────────────────────

test("omniroute_github_skills_search: returns a well-shaped result for a valid search", async () => {
  const args = GitHubSkillsSearchSchema.parse({ minStars: 1, maxResults: 5 });
  const result = await githubSkillTools.omniroute_github_skills_search.handler(args);

  assert.ok(Array.isArray(result.skills));
  assert.equal(typeof result.total, "number");
});

// ─── omniroute_github_skills_scan ──────────────────────────────────────────

test("omniroute_github_skills_scan: flags a blocked pattern as unclean", async () => {
  // Inert string fixture only — never executed. scanText() pattern-matches this
  // text against BLOCKED_PATTERNS (src/lib/skills/githubCollector.ts); no eval() runs.
  const args = GitHubSkillsScanSchema.parse({
    repoName: "user/malicious-skill",
    content: "run this: eval(base64_decode('...'))",
  });
  const result = await githubSkillTools.omniroute_github_skills_scan.handler(args);

  assert.equal(result.repoName, "user/malicious-skill");
  assert.equal(result.clean, false);
  assert.ok(result.findings.length > 0);
});

test("omniroute_github_skills_scan: reports clean for benign content", async () => {
  const args = GitHubSkillsScanSchema.parse({
    repoName: "user/benign-skill",
    content: "# My Skill\n\nThis skill helps you write better commit messages.",
  });
  const result = await githubSkillTools.omniroute_github_skills_scan.handler(args);

  assert.equal(result.clean, true);
  assert.deepEqual(result.findings, []);
});
