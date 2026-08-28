/**
 * OmniRoute MCP Session Pool Tools — Manage and monitor anonymous web session pools.
 *
 * Tools:
 *   1. omniroute_pool_status   — Get pool stats for one or all providers
 *   2. omniroute_pool_sessions — List per-session details for a provider's pool
 *   3. omniroute_pool_health   — Aggregated pool health with breaker state and issues
 */

import { z } from "zod";
import { PoolRegistry } from "../../services/sessionPool/poolRegistry.ts";
import { getWebSessionPoolHealth } from "../../services/webSessionPoolHealth.ts";

// ─── Input Schemas ─────────────────────────────────────────────────────────

export const poolStatusInput = z.object({
  provider: z
    .string()
    .optional()
    .describe("Provider name (e.g. 'pollinations'). Omit to list all pools"),
});

export const poolSessionsInput = z.object({
  provider: z.string().describe("Provider name (e.g. 'pollinations')"),
});

export const poolHealthInput = z.object({
  provider: z
    .string()
    .optional()
    .describe("Provider name (e.g. 'pollinations'). Omit to list all pools"),
});

// ─── Handlers ──────────────────────────────────────────────────────────────

/**
 * Handle pool_status tool: return stats for one or all pools
 */
export async function handlePoolStatus(
  args: z.infer<typeof poolStatusInput>
): Promise<Record<string, unknown>> {
  if (args.provider) {
    const stats = PoolRegistry.getStats(args.provider);
    if (!stats) {
      return { error: `No pool found for provider '${args.provider}'` };
    }
    return { provider: args.provider, stats };
  }

  const all = PoolRegistry.getAllStats();
  return {
    totalPools: all.length,
    providers: PoolRegistry.listProviders(),
    pools: all,
  };
}

/**
 * Handle pool_sessions tool: list per-session details for a provider's pool
 */
export async function handlePoolSessions(
  args: z.infer<typeof poolSessionsInput>
): Promise<Record<string, unknown>> {
  const details = PoolRegistry.getSessionDetails(args.provider);
  if (!details) {
    return { error: `No pool found for provider '${args.provider}'` };
  }

  const stats = PoolRegistry.getStats(args.provider);
  return {
    provider: args.provider,
    sessionCount: details.length,
    stats,
    sessions: details,
  };
}

export async function handlePoolHealth(
  args: z.infer<typeof poolHealthInput>
): Promise<Record<string, unknown>> {
  const report = getWebSessionPoolHealth(args.provider);
  return report as unknown as Record<string, unknown>;
}

// ─── Tool Registry ─────────────────────────────────────────────────────────

export const poolTools = {
  omniroute_pool_status: {
    name: "omniroute_pool_status",
    description:
      "Returns session pool status for a specific provider or all providers. Includes session counts by state (active/cooldown/dead), request totals, success rate, and throughput.",
    scopes: ["read:health"],
    inputSchema: poolStatusInput,
    handler: (args: z.infer<typeof poolStatusInput>) => handlePoolStatus(args),
  },
  omniroute_pool_sessions: {
    name: "omniroute_pool_sessions",
    description:
      "Lists all sessions in a provider's pool with per-session details: fingerprint, status, request counts, inflight, cooldown remaining, and age.",
    scopes: ["read:health"],
    inputSchema: poolSessionsInput,
    handler: (args: z.infer<typeof poolSessionsInput>) => handlePoolSessions(args),
  },
  omniroute_pool_health: {
    name: "omniroute_pool_health",
    description:
      "Returns aggregated web-session pool health: pool stats + circuit breaker state + per-session details + health status (healthy/degraded/down) + issues list.",
    scopes: ["read:health"],
    inputSchema: poolHealthInput,
    handler: (args: z.infer<typeof poolHealthInput>) => handlePoolHealth(args),
  },
};
