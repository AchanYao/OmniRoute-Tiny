/**
 * chatCore compression settings resolution (Quality Gate v2 / Fase 9 — chatCore god-file
 * decomposition, #3501).
 *
 * Extracted from handleChatCore's Proactive Context Compression setup: read the canonical
 * compression settings and derive the prompt-compression and delegated context-editing flags.
 * Best-effort — on a lookup error it logs and falls back to disabled, exactly like the previous
 * inline try/catch. Behaviour is byte-identical.
 */

import type { CompressionConfig } from "../../services/compression/types.ts";
import {
  getBuildCapabilities,
  resolveBuildProfile,
  type BuildProfile,
} from "@/shared/constants/buildProfile";

type LoggerLike = { warn?: (...args: unknown[]) => void } | null | undefined;
type CompressionSettingsLoader = () => Promise<{
  getCompressionSettings: typeof import("@/lib/db/compression").getCompressionSettings;
}>;

interface CompressionSettingsOptions {
  buildProfile?: BuildProfile;
  loadSettings?: CompressionSettingsLoader;
}

export async function resolveCompressionSettings(
  log?: LoggerLike,
  options: CompressionSettingsOptions = {}
): Promise<{
  settings: CompressionConfig | null;
  enabled: boolean;
  contextEditingEnabled: boolean;
}> {
  const capabilities = getBuildCapabilities(
    options.buildProfile ?? resolveBuildProfile(process.env)
  );
  if (!capabilities.promptCompression) {
    return { settings: null, enabled: false, contextEditingEnabled: false };
  }

  try {
    const { getCompressionSettings } = await (
      options.loadSettings ?? (() => import("@/lib/db/compression"))
    )();
    const settings = await getCompressionSettings();
    return {
      settings,
      enabled: settings.enabled,
      contextEditingEnabled: settings.contextEditing?.enabled === true,
    };
  } catch (err) {
    log?.warn?.(
      "COMPRESSION",
      "Compression settings lookup skipped: " + (err instanceof Error ? err.message : String(err))
    );
    return { settings: null, enabled: false, contextEditingEnabled: false };
  }
}
