/**
 * GET /api/github-skills
 *
 * GitHub agent skill discovery.
 *
 * GET:  Search GitHub for repos containing SKILL.md / agent skill files
 *       Query params: minStars, maxResults, minScore, query
 */
import { NextRequest, NextResponse } from "next/server";
import { searchGitHubSkills } from "@/lib/skills/githubCollector";
import { matchesSearch } from "@/shared/utils/turkishText";
import { sanitizeErrorMessage } from "@omniroute/open-sse/utils/error";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const minStars = parseInt(searchParams.get("minStars") ?? "1", 10);
    const maxResults = Math.min(parseInt(searchParams.get("maxResults") ?? "50", 10), 200);
    const minScore = parseFloat(searchParams.get("minScore") ?? "0");
    const query = searchParams.get("query") || "";

    const { repos, errors } = await searchGitHubSkills({
      minStars: isNaN(minStars) ? 1 : minStars,
      maxResults: isNaN(maxResults) ? 5 : maxResults,
    });

    let filtered = repos;
    if (minScore > 0) filtered = filtered.filter((r) => r.score >= minScore);
    if (query) {
      filtered = filtered.filter(
        (r) => matchesSearch(r.fullName, query) || matchesSearch(r.description, query)
      );
    }

    return NextResponse.json({
      skills: filtered.map((r) => ({
        fullName: r.fullName,
        stars: r.stars,
        score: r.score,
        description: r.description.slice(0, 300),
        hasSkillFile: r.hasSkillFile,
        license: r.license,
      })),
      total: filtered.length,
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (err) {
    const msg = sanitizeErrorMessage(err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: msg, skills: [], total: 0 }, { status: 500 });
  }
}
