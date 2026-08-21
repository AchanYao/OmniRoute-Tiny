import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { printSuccess, printInfo, printError } from "../io.mjs";
import { resolveActiveContext } from "../contexts.mjs";

export function resolveOmpPaths() {
  const home = homedir();
  const agentDir = join(home, ".omp", "agent");
  const extensionsDir = join(agentDir, "extensions");
  const modelsYaml = join(agentDir, "models.yml");
  return { agentDir, extensionsDir, modelsYaml };
}

export function generateOmpPluginExtensionCode({ baseUrl, apiKey, providerName = "omniroute" }) {
  const normalizedUrl = baseUrl.replace(/\/$/, "");
  return `// Bundled omniroute-omp-plugin for Oh My Pi
const EXCLUDED_TYPES = { image: true, embedding: true, audio: true, rerank: true, video: true };

export function filterModels(models) {
  if (!Array.isArray(models)) return [];
  return models.filter((m) => m && typeof m.id === "string" && !EXCLUDED_TYPES[(m.type || "").toLowerCase()]);
}

export function resolveOmpApi(model) {
  const fmt = (model.api_format || model.targetFormat || "").toLowerCase();
  if (fmt === "anthropic" || fmt === "claude" || fmt === "cc") return "anthropic-messages";
  if (fmt === "google" || fmt === "gemini") return "google-generative-ai";
  if (fmt === "openai-responses" || fmt === "codex") return "openai-responses";
  return "openai-completions";
}

export default function createOmpPlugin(options = {}) {
  const provider = options.providerName || "${providerName}";
  const baseUrl = (options.baseUrl || "${normalizedUrl}").replace(/\\/$/, "");
  const apiKey = options.apiKey || "${apiKey}";

  return (pi) => {
    if (!pi || typeof pi.registerProvider !== "function") return;

    pi.registerProvider({
      id: provider,
      name: "OmniRoute Gateway",
      fetchDynamicModels: async () => {
        try {
          const res = await fetch(\`\${baseUrl}/models\`, {
            headers: { Authorization: \`Bearer \${apiKey}\` },
          });
          if (!res.ok) return [];
          const json = await res.json();
          const list = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
          const valid = filterModels(list);

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
`;
}

export async function runSetupOmpCommand(opts = {}) {
  try {
    const context = await resolveActiveContext();
    const baseUrl = opts.baseUrl || context.baseURL || "http://localhost:3000/v1";
    const apiKey = opts.apiKey || context.apiKey || "sk-omniroute-dummy";

    const { extensionsDir, modelsYaml } = resolveOmpPaths();
    if (!existsSync(extensionsDir)) {
      mkdirSync(extensionsDir, { recursive: true });
    }

    const pluginPath = join(extensionsDir, "omniroute-omp-plugin.js");
    const code = generateOmpPluginExtensionCode({ baseUrl, apiKey });
    writeFileSync(pluginPath, code, "utf-8");

    const yamlConfig = `providers:\n  omniroute:\n    baseUrl: ${baseUrl}\n    apiKey: ${apiKey}\n    api: openai-completions\n`;
    writeFileSync(modelsYaml, yamlConfig, "utf-8");

    printSuccess("Configured Oh My Pi (OMP) plugin integration");
    printInfo(`Plugin extension: ${pluginPath}`);
    printInfo(`Models config: ${modelsYaml}`);
    return 0;
  } catch (err) {
    printError(`Failed to setup OMP plugin: ${err.message}`);
    return 1;
  }
}

export function registerSetupOmp(setupCommand) {
  if (!setupCommand) return;
  setupCommand
    .command("omp")
    .description("Wire the omniroute-omp-plugin to Oh My Pi (~/.omp/agent)")
    .option("--base-url <url>", "OmniRoute baseURL")
    .option("--api-key <key>", "OmniRoute API Key")
    .action(async (opts) => {
      const exitCode = await runSetupOmpCommand(opts);
      if (exitCode !== 0) process.exit(exitCode);
    });
}
