import { AntigravityExecutor } from "./antigravity.ts";
import { GithubExecutor } from "./github.ts";
import { GheCopilotExecutor } from "./ghe-copilot.ts";
import { KiroExecutor } from "./kiro.ts";
import { CodexExecutor } from "./codex.ts";
import { CursorExecutor } from "./cursor.ts";
import { TraeExecutor } from "./trae.ts";
import { DefaultExecutor } from "./default.ts";
import { BedrockExecutor } from "./bedrock.ts";
import { GlmExecutor } from "./glm.ts";
import { PollinationsExecutor } from "./pollinations.ts";
import { CloudflareAIExecutor } from "./cloudflare-ai.ts";
import { OpencodeExecutor } from "./opencode.ts";
import { PuterExecutor } from "./puter.ts";
import { VertexExecutor } from "./vertex.ts";
import { CliproxyapiExecutor } from "./cliproxyapi.ts";
import { DarioExecutor } from "./dario.ts";
import { NineRouterExecutor } from "./ninerouter.ts";
import { AzureOpenAIExecutor } from "./azure-openai.ts";
import { CommandCodeExecutor } from "./commandCode.ts";
import { GitlabExecutor } from "./gitlab.ts";
import { NlpCloudExecutor } from "./nlpcloud.ts";
import { WindsurfExecutor } from "./windsurf.ts";
import { ZedHostedExecutor } from "./zed-hosted.ts";
import { DevinCliExecutor } from "./devin-cli.ts";
import { DevinCliAgenticExecutor } from "./devin-cli-agentic.ts";
import { AuggieExecutor } from "./auggie.ts";
import { CheaperInferenceExecutor } from "./cheaperinference.ts";
import { RaycastExecutor } from "./raycast.ts";
import { KimiExecutor } from "./kimi.ts";
import { MoonshotExecutor } from "./moonshot.ts";
import { GrokCliExecutor } from "./grok-cli.ts";
import { CodeBuddyCnExecutor } from "./codebuddy-cn.ts";
import { XaiExecutor } from "./xai.ts";

const executors = {
  antigravity: new AntigravityExecutor(),
  agy: new AntigravityExecutor(),
  github: new GithubExecutor(),
  "ghe-copilot": new GheCopilotExecutor(),
  kiro: new KiroExecutor(),
  "amazon-q": new KiroExecutor("amazon-q"),
  bedrock: new BedrockExecutor(),
  codex: new CodexExecutor(),
  cursor: new CursorExecutor(),
  "cursor-oauth": new CursorExecutor(),
  trae: new TraeExecutor(),
  glm: new GlmExecutor("glm"),
  "glm-cn": new GlmExecutor("glm-cn"),
  glmt: new GlmExecutor("glmt"),
  cu: new CursorExecutor(),
  cuo: new CursorExecutor(),
  "azure-openai": new AzureOpenAIExecutor(),
  "command-code": new CommandCodeExecutor(),
  cmd: new CommandCodeExecutor(),
  gitlab: new GitlabExecutor(),
  "gitlab-duo": new GitlabExecutor("gitlab-duo"),
  nlpcloud: new NlpCloudExecutor(),
  pollinations: new PollinationsExecutor(),
  pol: new PollinationsExecutor(),
  "cloudflare-ai": new CloudflareAIExecutor(),
  cf: new CloudflareAIExecutor(),
  "opencode-zen": new OpencodeExecutor("opencode-zen"),
  "opencode-go": new OpencodeExecutor("opencode-go"),
  opencode: new OpencodeExecutor("opencode-zen"),
  puter: new PuterExecutor(),
  pu: new PuterExecutor(),
  vertex: new VertexExecutor(),
  "vertex-partner": new VertexExecutor(),
  cliproxyapi: new CliproxyapiExecutor(),
  cpa: new CliproxyapiExecutor(),
  dario: new DarioExecutor(),
  dr: new DarioExecutor(),
  "9router": new NineRouterExecutor(),
  nr: new NineRouterExecutor(),
  windsurf: new WindsurfExecutor(),
  ws: new WindsurfExecutor(),
  "zed-hosted": new ZedHostedExecutor(),
  "devin-cli": new DevinCliExecutor(),
  "devin-cli-agentic": new DevinCliAgenticExecutor(),
  devin: new DevinCliExecutor(),
  "kimi-coding-apikey": new KimiExecutor("kimi-coding-apikey"),
  "kimi-coding": new KimiExecutor(),
  moonshot: new MoonshotExecutor(),
  kimi: new MoonshotExecutor("kimi"),
  cheaperinference: new CheaperInferenceExecutor(),
  cinf: new CheaperInferenceExecutor("cheaperinference"),
  raycast: new RaycastExecutor(),
  rc: new RaycastExecutor(),
  "grok-cli": new GrokCliExecutor(),
  gc: new GrokCliExecutor(),
  "codebuddy-cn": new CodeBuddyCnExecutor(),
  cbcn: new CodeBuddyCnExecutor(),
  auggie: new AuggieExecutor(),
  xai: new XaiExecutor(),
  "xai-oauth": new XaiExecutor("xai-oauth"),
  xao: new XaiExecutor("xai-oauth"),
};

const defaultCache = new Map();

const CHAT_UNSUPPORTED_CLOUD_AGENT_PROVIDERS = new Set(["jules"]);

export function getExecutor(provider) {
  if (executors[provider]) return executors[provider];
  if (CHAT_UNSUPPORTED_CLOUD_AGENT_PROVIDERS.has(provider)) {
    const err = new Error(
      `Provider "${provider}" is a cloud-agent provider and does not support direct chat completions; use the Cloud Agents task API instead.`
    );
    (err as Error & { status?: number }).status = 400;
    throw err;
  }
  if (!defaultCache.has(provider)) defaultCache.set(provider, new DefaultExecutor(provider));
  return defaultCache.get(provider);
}

export function hasSpecializedExecutor(provider) {
  return !!executors[provider];
}

export { BaseExecutor } from "./base.ts";
export { AntigravityExecutor } from "./antigravity.ts";
export { GithubExecutor } from "./github.ts";
export { KiroExecutor } from "./kiro.ts";
export { CodexExecutor } from "./codex.ts";
export { CursorExecutor } from "./cursor.ts";
export { TraeExecutor } from "./trae.ts";
export { DefaultExecutor } from "./default.ts";
export { BedrockExecutor } from "./bedrock.ts";
export { GlmExecutor } from "./glm.ts";
export { PollinationsExecutor } from "./pollinations.ts";
export { CloudflareAIExecutor } from "./cloudflare-ai.ts";
export { OpencodeExecutor } from "./opencode.ts";
export { PuterExecutor } from "./puter.ts";
export { CliproxyapiExecutor } from "./cliproxyapi.ts";
export { DarioExecutor } from "./dario.ts";
export { NineRouterExecutor } from "./ninerouter.ts";
export { VertexExecutor } from "./vertex.ts";
export { AzureOpenAIExecutor } from "./azure-openai.ts";
export { CommandCodeExecutor } from "./commandCode.ts";
export { GitlabExecutor } from "./gitlab.ts";
export { NlpCloudExecutor } from "./nlpcloud.ts";
export { WindsurfExecutor } from "./windsurf.ts";
export { ZedHostedExecutor } from "./zed-hosted.ts";
export { DevinCliExecutor } from "./devin-cli.ts";
export { DevinCliAgenticExecutor } from "./devin-cli-agentic.ts";
export { AuggieExecutor } from "./auggie.ts";
export { GrokCliExecutor } from "./grok-cli.ts";
export { CodeBuddyCnExecutor } from "./codebuddy-cn.ts";
export { XaiExecutor } from "./xai.ts";
export { MoonshotExecutor } from "./moonshot.ts";
export { CheaperInferenceExecutor } from "./cheaperinference.ts";
