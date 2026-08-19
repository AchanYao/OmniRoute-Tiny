import { z } from "zod";
import { retrieveMemories } from "@/lib/memory/retrieval";
import { MemoryType } from "@/lib/memory/types";
import {
  getMemorySettings,
  toMemoryRetrievalConfig,
  DEFAULT_MEMORY_SETTINGS,
} from "@/lib/memory/settings";

export const MemorySearchSchema = z.object({
  apiKeyId: z.string(),
  query: z.string().optional(),
  type: z.enum(["factual", "episodic", "procedural", "semantic"]).optional(),
  maxTokens: z.number().int().positive().max(8000).optional(),
  limit: z.number().int().positive().max(100).optional(),
});

export const memoryTools = {
  omniroute_memory_search: {
    name: "omniroute_memory_search",
    description: "Search memories by query, type, or API key with token budget enforcement",
    scopes: ["read:memory"],
    inputSchema: MemorySearchSchema,
    handler: async (args: z.infer<typeof MemorySearchSchema>) => {
      // Plan 21 D16/Bug#7 fix: even on the error path the fallback must
      // respect DEFAULT_MEMORY_SETTINGS.strategy instead of hardcoding "exact".
      const memorySettings =
        (await getMemorySettings().catch(() => null)) ?? DEFAULT_MEMORY_SETTINGS;
      const baseConfig = toMemoryRetrievalConfig(memorySettings, {
        query: args.query,
      });

      const config = {
        ...baseConfig,
        enabled: true,
        maxTokens:
          args.maxTokens ??
          (memorySettings.enabled ? memorySettings.maxTokens : DEFAULT_MEMORY_SETTINGS.maxTokens),
      };

      const memories = await retrieveMemories(args.apiKeyId, config);

      const filtered = args.type ? memories.filter((m) => m.type === args.type) : memories;

      const limited = args.limit ? filtered.slice(0, args.limit) : filtered;

      return {
        success: true,
        data: {
          memories: limited,
          count: limited.length,
          totalTokens: limited.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0),
        },
      };
    },
  },
};
