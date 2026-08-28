export const WEB_COOKIE_SUNSET_ERROR =
  "Web-cookie / website-session providers are sunset in OmniRoute Tiny. Use an official API-key, OAuth, or compatible-node connection instead.";

export const WEB_COOKIE_SUNSET_STATUS = 410;

/**
 * Canonical website-session / website-scraper ids that Tiny no longer ships.
 *
 * Detection is by these ids (and the cookie-only aliases below). Official
 * aliases that collide with leftover nicknames must stay live: `poe`, `v0`
 * (`v0-vercel`), `hc` (`hackclub`).
 */
const SUNSET_PROVIDER_IDS: Record<string, true> = {
  "chatgpt-web": true,
  "grok-web": true,
  "gemini-web": true,
  "perplexity-web": true,
  "blackbox-web": true,
  "muse-spark-web": true,
  "claude-web": true,
  "deepseek-web": true,
  "copilot-web": true,
  "copilot-m365-web": true,
  "microsoft-designer-web": true,
  "t3-web": true,
  "inner-ai": true,
  "adapta-web": true,
  lmarena: true,
  "yuanbao-web": true,
  huggingchat: true,
  "poe-web": true,
  "venice-web": true,
  "v0-vercel-web": true,
  "kimi-web": true,
  "doubao-web": true,
  "hailuo-web": true,
  "qwen-web": true,
  "gemini-business": true,
  "zenmux-free": true,
  "zai-web": true,
  promptql: true,
  "notion-web": true,
  "adobe-firefly": true,
  hyperagent: true,
  "duckduckgo-web": true,
  "felo-web": true,
  theoldllm: true,
  chipotle: true,
  "veoaifree-web": true,
  mimocode: true,
  suno: true,
  udio: true,
};

/**
 * Cookie/scraper-only executor aliases that are not also a live official id.
 * Keep this disjoint from `poe`, `v0`, `hc`.
 */
const SUNSET_EXECUTOR_ALIASES: Record<string, true> = {
  "cgpt-web": true,
  gw: true,
  gweb: true,
  "pplx-web": true,
  "bb-web": true,
  "ms-web": true,
  cw: true,
  "cw-web": true,
  "ds-web": true,
  m365copilot: true,
  msdesigner: true,
  t3chat: true,
  "in-ai": true,
  "adp-web": true,
  lma: true,
  ybw: true,
  ven: true,
  gembiz: true,
  zmf: true,
  zw: true,
  pql: true,
  nw: true,
  huggingchat: true,
  firefly: true,
  ha: true,
  copilot: true,
  db: true,
  ddgw: true,
  felo: true,
  "veo-free": true,
  tllm: true,
  pepper: true,
  mcode: true,
};

export function isSunsetWebCookieProviderId(providerId: unknown): boolean {
  return typeof providerId === "string" && SUNSET_PROVIDER_IDS[providerId] === true;
}

export function isSunsetWebCookieExecutorAlias(providerId: unknown): boolean {
  return typeof providerId === "string" && SUNSET_EXECUTOR_ALIASES[providerId] === true;
}

export function isSunsetWebCookieChatTarget(providerId: unknown): boolean {
  return isSunsetWebCookieProviderId(providerId) || isSunsetWebCookieExecutorAlias(providerId);
}

/**
 * Leftover `provider/model` strings still 410 after cookie registry stubs
 * are gone. Prefix is the first path segment; official `poe` / `v0` / `hc`
 * stay live because they are not in the sunset alias table.
 */
export function sunsetProviderFromModelString(modelStr: unknown): string | null {
  if (typeof modelStr !== "string") return null;
  const trimmed = modelStr.trim();
  if (!trimmed) return null;
  const slash = trimmed.indexOf("/");
  const prefix = slash > 0 ? trimmed.slice(0, slash) : trimmed;
  return isSunsetWebCookieChatTarget(prefix) ? prefix : null;
}

export function webCookieSunsetError(status: number = WEB_COOKIE_SUNSET_STATUS): Error & {
  status: number;
} {
  const err = new Error(WEB_COOKIE_SUNSET_ERROR) as Error & { status: number };
  err.status = status;
  return err;
}

export function webCookieSunsetHandlerResult(): { success: false; status: number; error: string } {
  return {
    success: false,
    status: WEB_COOKIE_SUNSET_STATUS,
    error: WEB_COOKIE_SUNSET_ERROR,
  };
}
