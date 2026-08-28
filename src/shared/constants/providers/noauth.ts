/**
 * Provider catalog data — extracted from providers.ts (god-file decomposition).
 * Pure data literal; re-exported by the providers.ts barrel. No behavior change.
 */
export const NOAUTH_PROVIDERS = {
  "devin-cli-agentic": {
    id: "devin-cli-agentic",
    alias: "dva",
    name: "Devin CLI Agentic Bridge",
    icon: "terminal",
    color: "#635BFF",
    textIcon: "DV",
    website: "https://docs.devin.ai/work-with-devin/devin-cli",
    noAuth: true,
    hasFree: false,
    serviceKinds: ["llm"],
    isLocalCli: true,
    toolCalling: "emulated",
    authHint: "Authentication is owned by the official Devin CLI in its isolated bridge volume.",
    notice: {
      text: "This provider accepts only the official Devin CLI over local ACP stdio and never falls back to another provider.",
    },
  },
  opencode: {
    id: "opencode",
    alias: "oc",
    name: "OpenCode Free",
    icon: "terminal",
    color: "#E87040",
    textIcon: "OC",
    website: "https://opencode.ai",
    noAuth: true,
    hasFree: true,
    serviceKinds: ["llm"],
    authHint: "No API key required — uses OpenCode's public free endpoint.",
    freeNote:
      "No API key required — public OpenCode endpoint with Kimi, GLM, Qwen, MiMo, MiniMax models.",
    notice: {
      text: "OpenCode Free uses the public OpenCode endpoint (https://opencode.ai/zen/v1). No signup or API key needed. Rate limits apply.",
    },
  },
  auggie: {
    id: "auggie",
    alias: "aug",
    name: "Augment (Auggie CLI)",
    icon: "terminal",
    color: "#7C3AED",
    textIcon: "AU",
    website: "https://augmentcode.com",
    noAuth: true,
    hasFree: false,
    serviceKinds: ["llm"],
    isLocalCli: true,
    freeNote:
      "Local passthrough — runs the Augment CLI (`auggie`) on this machine. Auth is handled by `auggie login`, not OmniRoute.",
    authHint:
      "No API key stored by OmniRoute. Install the Auggie CLI and run `auggie login` on this machine, then OmniRoute spawns it locally for each request.",
    notice: {
      text: "Augment (Auggie CLI) requires the `auggie` binary installed and authenticated locally (`auggie login`). OmniRoute spawns it as a subprocess and never sees or stores your Augment credentials.",
    },
  },
  aihorde: {
    id: "aihorde",
    alias: "horde",
    name: "AI Horde",
    icon: "diversity_3",
    color: "#8B5CF6",
    textIcon: "AH",
    website: "https://aihorde.net",
    noAuth: true,
    hasFree: true,
    passthroughModels: true,
    serviceKinds: ["llm"],
    authHint:
      "No API key required — uses AI Horde's documented anonymous key. Adding a free aihorde.net key is optional and only buys higher queue priority (kudos).",
    freeNote:
      "Crowdsourced inference from volunteer GPUs. Throughput is a shared queue, not a quota: there is no RPM/RPD cap, but waits grow when the network is busy.",
    notice: {
      text: "AI Horde routes to volunteer-run workers, so responses can take minutes and tool calling is unavailable. Model availability changes as workers come and go.",
    },
  },
};

// Provider-level proxy controls are exposed only for transports whose complete
// upstream path runs through OmniRoute's proxy-aware global fetch. Providers
// with browser, WebSocket, direct dispatcher, media, or local CLI paths stay
// hidden until those paths can guarantee the configured provider proxy.
export const NOAUTH_PROVIDER_PROXY_SUPPORTED = new Set(["opencode"]);

export function supportsNoAuthProviderProxy(providerId: string): boolean {
  return NOAUTH_PROVIDER_PROXY_SUPPORTED.has(providerId);
}
