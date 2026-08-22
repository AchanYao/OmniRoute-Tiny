import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export function getOmpExtensionsDir() {
  const home = os.homedir();
  return path.join(home, ".omp", "agent", "extensions");
}

export function generateOmpPluginExtensionCode({ baseUrl, apiKey, providerName = "omniroute" }) {
  const normalizedUrl = baseUrl.replace(/\/$/, "");
  return `// Bundled omniroute-omp-plugin for Oh My Pi
const EXCLUDED_TYPES = { image: true, embedding: true, audio: true, rerank: true, video: true };
const EXCLUDED_OWNERS = { comfyui: true, recraft: true, topaz: true, suno: true, udio: true, midjourney: true, "black-forest-labs": true, stability: true };
const NON_CHAT_ID_PATTERNS = [/-image/i, /midjourney/i, /flux-/i, /stable-diffusion/i, /dall-e/i, /tts-/i, /whisper-/i, /sora-/i, /imagen-/i, /bge-reranker/i];

const ANTHROPIC_KEYS = { anthropic: true, claude: true, cc: true };
const GOOGLE_KEYS = { google: true, gemini: true };
const RESPONSES_KEYS = { "openai-responses": true, responses: true, codex: true, "grok-cli": true, "xai-oauth": true, xai: true, gc: true, xao: true };

export function filterModels(models) {
  if (!Array.isArray(models)) return [];
  return models.filter((m) => {
    if (!m || typeof m.id !== "string") return false;
    if (m.type && EXCLUDED_TYPES[m.type.toLowerCase()]) return false;
    const lowerId = m.id.toLowerCase();
    if (NON_CHAT_ID_PATTERNS.some((p) => p.test(lowerId))) return false;
    if (m.owned_by && EXCLUDED_OWNERS[m.owned_by.toLowerCase()]) return false;
    return true;
  });
}

export function resolveOmpApi(model) {
  const fmt = (model.api_format || model.targetFormat || "").toLowerCase();
  if (fmt) {
    if (ANTHROPIC_KEYS[fmt]) return "anthropic-messages";
    if (GOOGLE_KEYS[fmt]) return "google-generative-ai";
    if (RESPONSES_KEYS[fmt]) return "openai-responses";
    if (fmt === "openai" || fmt === "chat-completions") return "openai-completions";
  }

  // Gateway fallback: do NOT guess wire protocol by model author/ID
  return "openai-completions";
}

export default function createOmpPlugin(options = {}) {
  const provider = options.providerName || "${providerName}";
  const baseUrl = (options.baseUrl || "${normalizedUrl}").replace(/\\/$/, "");
  const apiKey = options.apiKey || "${apiKey}";

  return (pi) => {
    if (!pi || typeof pi.registerProvider !== "function") return;

    fetch(\`\${baseUrl}/models\`, {
      headers: apiKey ? { Authorization: \`Bearer \${apiKey}\` } : {},
    })
      .then((res) => res.json())
      .then((data) => {
        const rawList = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        const chatModels = filterModels(rawList);
        if (chatModels.length === 0) return;

        const modelsByApi = {};
        for (const m of chatModels) {
          const apiType = resolveOmpApi(m);
          if (!modelsByApi[apiType]) modelsByApi[apiType] = [];
          modelsByApi[apiType].push({ id: m.id, name: typeof m.name === "string" ? m.name : m.id });
        }

        for (const [apiType, modelsList] of Object.entries(modelsByApi)) {
          const suffix = apiType === "openai-completions" ? "" : \`-\${apiType}\`;
          pi.registerProvider({
            name: \`\${provider}\${suffix}\`,
            baseUrl: baseUrl,
            apiKey: apiKey || "dummy-key",
            models: modelsList,
          });
        }
      })
      .catch((err) => {
        console.error(\`[OMP Plugin] Failed to discover models from \${baseUrl}:\`, err);
      });
  };
}
`;
}

export async function setupOmpPlugin({ baseUrl, apiKey, providerName = "omniroute" }) {
  const extDir = getOmpExtensionsDir();
  if (!fs.existsSync(extDir)) {
    fs.mkdirSync(extDir, { recursive: true });
  }

  const extensionPath = path.join(extDir, "omniroute-plugin.js");
  const code = generateOmpPluginExtensionCode({ baseUrl, apiKey, providerName });
  fs.writeFileSync(extensionPath, code, "utf-8");

  return extensionPath;
}
