/**
 * githubSkillTools.ts — MCP tools for GitHub agent skill discovery and import.
 *
 * Provides tools to:
 *   - Search GitHub for repos with SKILL.md / agent skill files
 *   - Score and rank discovered skills
 *   - Scan skill content for blocked patterns (malware, secrets)
 *   - Install skills into Hermes, Claude, Gemini, OpenCode
 *
 * Backed by the githubCollector library at src/lib/skills/githubCollector.ts.
 */

import { z } from "zod";
import {
  searchGitHubSkills,
  scanText,
  GitHubSkillsSearchSchema,
  GitHubSkillsScanSchema,
  type GitHubSkillRepo,
} from "@/lib/skills/githubCollector";

// ── Handlers ─────────────────────────────────────────────────────────────────

async function handleSearch(args: z.infer<typeof GitHubSkillsSearchSchema>) {
  const { repos, errors } = await searchGitHubSkills({
    minStars: args.minStars,
    maxResults: args.maxResults,
  });

  let filtered = repos;
  if (args.minScore > 0) filtered = filtered.filter((r) => r.score >= args.minScore);
  if (args.query) {
    const q = args.query.toLowerCase();
    filtered = filtered.filter(
      (r) => r.fullName.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)
    );
  }

  return {
    skills: filtered.map((r: GitHubSkillRepo) => ({
      fullName: r.fullName,
      stars: r.stars,
      score: r.score,
      description: r.description.slice(0, 200),
      topics: r.topics,
      htmlUrl: r.htmlUrl,
      hasSkillFile: r.hasSkillFile,
      license: r.license,
    })),
    total: filtered.length,
    errors: errors.length > 0 ? errors : undefined,
  };
}

async function handleScan(args: z.infer<typeof GitHubSkillsScanSchema>) {
  const findings = scanText(args.content, args.repoName);
  return {
    repoName: args.repoName,
    clean: findings.length === 0,
    findings: findings.map((f) => ({
      pattern: f.pattern,
      context: f.context,
    })),
  };
}

// ── Tool Definitions ─────────────────────────────────────────────────────────

export const githubSkillTools = {
  omniroute_github_skills_search: {
    name: "omniroute_github_skills_search",
    description:
      "Search GitHub for agent skill repositories that contain SKILL.md, CLAUDE.md, .cursorrules, or similar agent configuration files. " +
      "Returns scored results sorted by relevance. Scores are 0.0–1.0 based on stars, name signals, description keywords, and topic tags. " +
      "Ideal for discovering community agent skills from GitHub.",
    inputSchema: GitHubSkillsSearchSchema,
    scopes: ["read:skills"],
    handler: handleSearch,
  },

  omniroute_github_skills_scan: {
    name: "omniroute_github_skills_scan",
    description:
      "Scan SKILL.md or README content from a GitHub repo for blocked patterns including eval(base64), " +
      "hardcoded secrets (API keys, passwords, private keys), dangerous function calls (os.system, subprocess.Popen), " +
      "and other malware indicators. Returns findings with context or 'clean' status.",
    inputSchema: GitHubSkillsScanSchema,
    scopes: ["read:skills"],
    handler: handleScan,
  },
};
