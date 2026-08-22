export interface RawModel {
  id: string;
  name?: string;
  type?: string;
  input?: string[];
  output?: string[];
  api_format?: string;
  targetFormat?: string;
  owned_by?: string;
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
    name: string;
    baseUrl: string;
    apiKey?: string;
    models?: Array<{ id: string; name?: string }>;
  }): void;
}

const EXCLUDED_TYPES: Record<string, true> = {
  image: true,
  embedding: true,
  audio: true,
  rerank: true,
  video: true,
};

const EXCLUDED_OWNERS: Record<string, true> = {
  comfyui: true,
  recraft: true,
  topaz: true,
  suno: true,
  udio: true,
  midjourney: true,
  "black-forest-labs": true,
  stability: true,
};

const NON_CHAT_ID_PATTERNS: RegExp[] = [
  /-image/i,
  /midjourney/i,
  /flux-/i,
  /stable-diffusion/i,
  /dall-e/i,
  /tts-/i,
  /whisper-/i,
  /sora-/i,
  /imagen-/i,
  /bge-reranker/i,
];

const ANTHROPIC_KEYS: Record<string, true> = {
  anthropic: true,
  claude: true,
  cc: true,
};

const GOOGLE_KEYS: Record<string, true> = {
  google: true,
  gemini: true,
};

const RESPONSES_KEYS: Record<string, true> = {
  "openai-responses": true,
  responses: true,
  codex: true,
  "grok-cli": true,
  "xai-oauth": true,
  xai: true,
  gc: true,
  xao: true,
};

export function filterModels(models: RawModel[]): RawModel[] {
  if (!Array.isArray(models)) return [];
  return models.filter((m) => {
    if (!m || typeof m.id !== "string") return false;
    if (m.type && EXCLUDED_TYPES[m.type.toLowerCase()]) {
      return false;
    }
    const lowerId = m.id.toLowerCase();
    if (NON_CHAT_ID_PATTERNS.some((pattern) => pattern.test(lowerId))) {
      return false;
    }
    if (m.owned_by) {
      const lowerOwner = m.owned_by.toLowerCase();
      if (EXCLUDED_OWNERS[lowerOwner]) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Resolve OMP native API protocol.
 * Server-driven: strictly relies on the model's `api_format` or `targetFormat`
 * returned by OmniRoute GET /v1/models.
 * Defaults to `openai-completions` (the standard OmniRoute /v1 gateway protocol)
 * to prevent client-side misrouting when a provider (e.g. Cursor, Gemini sub,
 * or OpenAI proxy) serves foreign models through a unified protocol.
 */
export function resolveOmpApi(model: RawModel): string {
  const fmt = (model.api_format || model.targetFormat || "").toLowerCase();
  if (fmt) {
    if (ANTHROPIC_KEYS[fmt]) return "anthropic-messages";
    if (GOOGLE_KEYS[fmt]) return "google-generative-ai";
    if (RESPONSES_KEYS[fmt]) return "openai-responses";
    if (fmt === "openai" || fmt === "chat-completions") return "openai-completions";
  }

  // Safe gateway default when server omits api_format — do NOT guess by model ID or vendor
  return "openai-completions";
}

export default function createOmpPlugin(
  options: {
    baseUrl?: string;
    apiKey?: string;
    providerName?: string;
  } = {}
) {
  const baseUrl = options.baseUrl || "http://localhost:3000";
  const apiKey = options.apiKey || process.env.OMNIROUTE_API_KEY;
  const providerName = options.providerName || "omniroute";

  return function (api: OmpExtensionApi) {
    if (!api || typeof api.registerProvider !== "function") return;

    fetch(`${baseUrl}/v1/models`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    })
      .then((res) => res.json())
      .then((data) => {
        const rawList = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        const chatModels = filterModels(rawList);
        if (chatModels.length === 0) return;

        // Group models by resolved OMP native API format
        const modelsByApi: Record<string, Array<{ id: string; name?: string }>> = {};

        for (const m of chatModels) {
          const apiType = resolveOmpApi(m);
          if (!modelsByApi[apiType]) modelsByApi[apiType] = [];
          modelsByApi[apiType].push({
            id: m.id,
            name: typeof m.name === "string" ? m.name : m.id,
          });
        }

        // Register each API type as a distinct provider in OMP
        for (const [apiType, modelsList] of Object.entries(modelsByApi)) {
          const suffix = apiType === "openai-completions" ? "" : `-${apiType}`;
          api.registerProvider({
            name: `${providerName}${suffix}`,
            baseUrl: `${baseUrl}/v1`,
            apiKey: apiKey || "dummy-key",
            models: modelsList,
          });
        }
      })
      .catch((err) => {
        console.error(`[OMP Plugin] Failed to discover models from ${baseUrl}:`, err);
      });
  };
}
