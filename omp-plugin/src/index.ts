export interface RawModel {
  id: string;
  name?: string;
  type?: string;
  input?: string[];
  output?: string[];
  api_format?: string;
  targetFormat?: string;
  [key: string]: unknown;
}

export interface OmpModelSpec {
  id: string;
  name: string;
  api: string;
  provider: string;
  baseUrl: string;
}

export interface OmpExtensionApi {
  registerProvider(provider: {
    id: string;
    name: string;
    fetchDynamicModels: () => Promise<OmpModelSpec[]>;
  }): void;
}

const EXCLUDED_TYPES: Record<string, true> = {
  image: true,
  embedding: true,
  audio: true,
  rerank: true,
  video: true,
};

export function filterModels(models: RawModel[]): RawModel[] {
  if (!Array.isArray(models)) return [];
  return models.filter((m) => {
    if (!m || typeof m.id !== "string") return false;
    if (m.type && EXCLUDED_TYPES[m.type.toLowerCase()]) {
      return false;
    }
    return true;
  });
}

export function resolveOmpApi(model: RawModel): string {
  const fmt = (model.api_format || model.targetFormat || "").toLowerCase();
  if (fmt === "anthropic" || fmt === "claude" || fmt === "cc") {
    return "anthropic-messages";
  }
  if (fmt === "google" || fmt === "gemini") {
    return "google-generative-ai";
  }
  if (fmt === "openai-responses" || fmt === "codex") {
    return "openai-responses";
  }
  return "openai-completions";
}

export default function createOmpPlugin(options: {
  baseUrl?: string;
  apiKey?: string;
  providerName?: string;
} = {}) {
  const provider = options.providerName || "omniroute";
  const baseUrl = (options.baseUrl || "http://localhost:3000/v1").replace(/\/$/, "");
  const apiKey = options.apiKey || "sk-omniroute-dummy";

  return (pi: OmpExtensionApi) => {
    if (!pi || typeof pi.registerProvider !== "function") {
      return;
    }

    pi.registerProvider({
      id: provider,
      name: "OmniRoute Gateway",
      fetchDynamicModels: async () => {
        try {
          const res = await fetch(`${baseUrl}/models`, {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          });
          if (!res.ok) return [];
          const json = (await res.json()) as Record<string, unknown>;
          const rawList = Array.isArray(json.data)
            ? (json.data as RawModel[])
            : Array.isArray(json)
            ? (json as RawModel[])
            : [];
          const valid = filterModels(rawList);

          return valid.map((m) => ({
            id: m.id,
            name: m.name || m.id,
            api: resolveOmpApi(m),
            provider,
            baseUrl,
          }));
        } catch {
          return [];
        }
      },
    });
  };
}
