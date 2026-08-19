import { z } from "zod";
import {
  createObsidianClient,
  createSyncServerClient,
  getSyncToken,
} from "../../../src/lib/obsidian/api.ts";
import {
  getObsidianToken,
  getObsidianBaseUrl,
  getObsidianConfigForApiKey,
} from "../../../src/lib/db/obsidian.ts";
import type { ObsidianClient, SyncServerClient } from "../../../src/lib/obsidian/api.ts";

type McpExtra = {
  authInfo?: { clientId?: string; scopes?: string[] };
  sessionId?: string;
};

function extractApiKeyId(extra?: McpExtra): string | undefined {
  const id = extra?.authInfo?.clientId;
  return typeof id === "string" && id.length > 0 && id !== "anonymous" && id !== "env-key"
    ? id
    : undefined;
}

function requireToken(apiKeyId?: string): string {
  const config = getObsidianConfigForApiKey(apiKeyId);
  if (!config.token) {
    throw new Error(
      "Obsidian API token not configured. Set it in Settings > Context Sources" +
        (apiKeyId ? " or in your API key's context source settings" : "") +
        "."
    );
  }
  return config.token;
}

function getClient(apiKeyId?: string): ObsidianClient {
  const config = getObsidianConfigForApiKey(apiKeyId);
  const token = requireToken(apiKeyId);
  return createObsidianClient(token, config.baseUrl);
}

export const obsidianTools = [
  {
    name: "obsidian_check_status",
    description:
      "Check whether the Obsidian Local REST API is reachable and authenticated. Returns connection status.",
    scopes: ["read:obsidian"],
    inputSchema: z.object({}),
    handler: async (_args: unknown, extra?: McpExtra) => {
      const client = getClient(extractApiKeyId(extra));
      return client.checkStatus();
    },
  },
  {
    name: "obsidian_search_simple",
    description:
      "Search note content in Obsidian vault by text query. Returns matching snippets with file paths.",
    scopes: ["read:obsidian"],
    inputSchema: z.object({
      query: z.string().min(1).max(500).describe("Search query text"),
      contextLength: z
        .number()
        .min(20)
        .max(500)
        .default(100)
        .describe("Characters of context around each match"),
    }),
    handler: async (args: { query: string; contextLength?: number }, extra?: McpExtra) => {
      const client = getClient(extractApiKeyId(extra));
      return client.searchSimple(args.query, args.contextLength);
    },
  },
  {
    name: "obsidian_search_structured",
    description:
      "Search Obsidian vault using a JSON Logic expression for complex queries (and, or, regex, path filters, etc.).",
    scopes: ["read:obsidian"],
    inputSchema: z.object({
      jsonLogic: z.unknown().describe("JSON Logic expression for the search query"),
    }),
    handler: async (args: { jsonLogic: unknown }, extra?: McpExtra) => {
      const client = getClient(extractApiKeyId(extra));
      return client.searchStructured(args.jsonLogic);
    },
  },
  {
    name: "obsidian_read_note",
    description:
      "Read the full content of a note in the Obsidian vault by its vault-relative path. Optionally target a specific heading or block.",
    scopes: ["read:obsidian"],
    inputSchema: z.object({
      path: z.string().min(1).describe("Vault-relative path (e.g., 'notes/my-note.md')"),
      targetType: z
        .enum(["heading", "block", "frontmatter"])
        .optional()
        .describe("Scope the read to a specific type of target"),
      target: z
        .string()
        .optional()
        .describe(
          "Target identifier: heading text, block index (e.g., '^block-id'), or 'frontmatter'"
        ),
    }),
    handler: async (
      args: { path: string; targetType?: "heading" | "block" | "frontmatter"; target?: string },
      extra?: McpExtra
    ) => {
      const client = getClient(extractApiKeyId(extra));
      return client.readNote(args.path, args.targetType, args.target);
    },
  },
  {
    name: "obsidian_list_vault",
    description:
      "List files and directories in the Obsidian vault. Returns a tree of file/folder entries.",
    scopes: ["read:obsidian"],
    inputSchema: z.object({
      path: z
        .string()
        .optional()
        .default("")
        .describe("Vault-relative directory path to list (empty for root)"),
    }),
    handler: async (args: { path?: string }, extra?: McpExtra) => {
      const client = getClient(extractApiKeyId(extra));
      return client.listVault(args.path);
    },
  },
  {
    name: "obsidian_get_document_map",
    description:
      "Get the document structure of a note as a map of headings and their line numbers.",
    scopes: ["read:obsidian"],
    inputSchema: z.object({
      path: z.string().min(1).describe("Vault-relative path to the note"),
    }),
    handler: async (args: { path: string }, extra?: McpExtra) => {
      const client = getClient(extractApiKeyId(extra));
      return client.getDocumentMap(args.path);
    },
  },
  {
    name: "obsidian_get_note_metadata",
    description:
      "Get metadata (frontmatter, tags, links, char/word count) for a note without reading its full content.",
    scopes: ["read:obsidian"],
    inputSchema: z.object({
      path: z.string().min(1).describe("Vault-relative path to the note"),
    }),
    handler: async (args: { path: string }, extra?: McpExtra) => {
      const client = getClient(extractApiKeyId(extra));
      return client.getNoteMetadata(args.path);
    },
  },
  {
    name: "obsidian_get_active_file",
    description: "Get the path and content of the currently active file in Obsidian.",
    scopes: ["read:obsidian"],
    inputSchema: z.object({}),
    handler: async (_args: unknown, extra?: McpExtra) => {
      const client = getClient(extractApiKeyId(extra));
      return client.getActiveFile();
    },
  },
  {
    name: "obsidian_get_periodic_note",
    description:
      "Get the daily, weekly, or monthly periodic note for a given date (or today if no date specified).",
    scopes: ["read:obsidian"],
    inputSchema: z.object({
      period: z.enum(["daily", "weekly", "monthly"]).describe("Period type"),
      year: z.number().int().optional().describe("Year (required if month/day provided)"),
      month: z.number().int().min(1).max(12).optional().describe("Month"),
      day: z.number().int().min(1).max(31).optional().describe("Day"),
    }),
    handler: async (
      args: { period: "daily" | "weekly" | "monthly"; year?: number; month?: number; day?: number },
      extra?: McpExtra
    ) => {
      const client = getClient(extractApiKeyId(extra));
      return client.getPeriodicNote(args.period, args.year, args.month, args.day);
    },
  },
  {
    name: "obsidian_get_tags",
    description: "List all tags used across the Obsidian vault with their frequencies.",
    scopes: ["read:obsidian"],
    inputSchema: z.object({}),
    handler: async (_args: unknown, extra?: McpExtra) => {
      const client = getClient(extractApiKeyId(extra));
      return client.getTags();
    },
  },
  {
    name: "obsidian_list_commands",
    description:
      "List all available Obsidian commands with their IDs and names. Use IDs with obsidian_execute_command.",
    scopes: ["read:obsidian"],
    inputSchema: z.object({}),
    handler: async (_args: unknown, extra?: McpExtra) => {
      const client = getClient(extractApiKeyId(extra));
      return client.commandList();
    },
  },
  {
    name: "obsidian_sync_status",
    description:
      "Get the OmniRoute sync plugin status: whether the server is running, vault name, port, uptime, and last sync results. Requires the sync auth token to be configured in OmniRoute settings.",
    scopes: ["read:obsidian"],
    inputSchema: z.object({}),
    handler: async (_args: unknown, extra?: McpExtra) => {
      const token = getSyncToken() || requireToken(extractApiKeyId(extra));
      const syncClient = createSyncServerClient(token);
      return syncClient.getStatus();
    },
  },
  {
    name: "obsidian_sync_conflicts",
    description:
      "List unresolved sync conflicts. Each conflict shows the file path, conflict file path, and when it was detected. Requires the sync auth token to be configured in OmniRoute settings.",
    scopes: ["read:obsidian"],
    inputSchema: z.object({}),
    handler: async (_args: unknown, extra?: McpExtra) => {
      const token = getSyncToken() || requireToken(extractApiKeyId(extra));
      const syncClient = createSyncServerClient(token);
      return syncClient.getConflicts();
    },
  },
];
