/**
 * MCP Plugin Tools — 8 tools for plugin management.
 *
 * @module mcp-server/tools/pluginTools
 */

import { z } from "zod";
import { resolve, normalize, isAbsolute } from "path";
import { listPlugins, getPluginByName } from "../../../src/lib/db/plugins";

/**
 * Validate a path is safe for plugin installation.
 * Prevents directory traversal and null byte injection.
 */
function validatePluginPath(path: string): string {
  // Reject null bytes
  if (path.includes("\0")) {
    throw new Error("Invalid path: contains null bytes");
  }
  // Must be absolute
  if (!isAbsolute(path)) {
    throw new Error("Path must be absolute");
  }
  // Normalize and resolve to prevent traversal
  const normalized = normalize(resolve(path));
  // Reject paths with traversal patterns
  if (normalized.includes("..") || normalized.includes("~")) {
    throw new Error("Invalid path: directory traversal detected");
  }
  return normalized;
}

export const pluginTools = [
  {
    name: "plugin_list",
    description: "List all installed plugins with their status, hooks, and metadata.",
    scopes: ["read:plugins"],
    inputSchema: z.object({
      status: z
        .enum(["installed", "active", "inactive", "error"])
        .optional()
        .describe("Filter by plugin status"),
    }),
    handler: async (args: { status?: string }) => {
      const plugins = listPlugins(args.status as any);
      return {
        plugins: plugins.map((p) => ({
          name: p.name,
          version: p.version,
          description: p.description,
          status: p.status,
          enabled: p.enabled === 1,
          hooks: JSON.parse(p.hooks || "[]"),
          permissions: JSON.parse(p.permissions || "[]"),
          installedAt: p.installedAt,
          activatedAt: p.activatedAt,
        })),
      };
    },
  },

  {
    name: "plugin_executions",
    description: "View plugin execution metrics (from plugin_analytics table).",
    scopes: ["read:plugins"],
    inputSchema: z.object({
      name: z.string().optional().describe("Filter by plugin name"),
      limit: z.number().min(1).max(100).default(20).describe("Max results to return"),
    }),
    handler: async (args: { name?: string; limit?: number }) => {
      const { getPluginAnalytics, getPluginAnalyticsSummary } =
        await import("../../../src/lib/db/plugins");
      const limit = args.limit || 20;
      if (args.name) {
        const rows = getPluginAnalytics(args.name).slice(0, limit);
        return { metrics: rows };
      }
      // No name filter: return all plugins' summaries
      const allPlugins = listPlugins();
      const metrics = allPlugins.slice(0, limit).map((p) => getPluginAnalyticsSummary(p.name));
      return { metrics };
    },
  },
];
