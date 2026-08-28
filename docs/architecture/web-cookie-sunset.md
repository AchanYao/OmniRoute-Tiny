---
title: "ADR: Sunset web-cookie providers in OmniRoute Tiny"
status: accepted
lastUpdated: 2026-08-28
---

# ADR: Sunset web-cookie providers in OmniRoute Tiny

- **Status:** Accepted and live for OmniRoute Tiny. Product surface is fail-closed.
- **Scope:** Cookie / website-session / unofficial website-scraper providers are no longer listable, creatable, or callable. Catalog, executors, media stubs, browser-pool / VNC cookie login, and cookie validators are deleted. Leftover SQLite rows and client `provider/model` strings still 410. Official `poe` / `v0-vercel` / `hackclub` stay live.

## Context

OmniRoute Tiny is a self-hosted aggregation gateway. It should expose a stable OpenAI-compatible (and sibling) API over **official, durable credentials**: API keys, OAuth, and local/compatible nodes.

The inherited tree included **web-cookie** providers. Those connections authenticated with a pasted browser session and replayed reverse-engineered website chat endpoints. That catalog, those executors, and cookie media stubs are deleted.

That path could be hung off `/v1` as a proxy. Local client tools could sometimes run if an executor prompt-emulated `tools[]` via `open-sse/translator/webTools.ts`. That is not native function calling. It is also not the contract Tiny wants to keep:

- Website chat UIs typically have no first-class tools protocol; emulation is best-effort and silently degrades to prose.
- Sessions expire, bind to IP / User-Agent / TLS fingerprint, and require Playwright / Chromium / VNC helpers.
- Catalog, validation, quota, and anti-bot work is large, unofficial, and ToS-hostile relative to a gateway.
- Tiny's retained surface is OAuth + API-key connections, native streaming, and real tool/reasoning protocols.

## Decision

**Web-cookie is not a Tiny product class.** Runtime traffic is fail-closed, and the unofficial website-backed source is deleted.

| Keep                                                                  | Runtime now                                                            | Later deletion                                                   |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| API-key providers                                                     | Dashboard add-provider and `/v1/models` omit cookie sources            | Operator-delete leftover SQLite cookie rows after migration      |
| OAuth providers (Claude Code, Codex, Cursor, Antigravity, …)          | New cookie creates return **410**                                      | Unused i18n cookie-hint strings if a later copy sweep wants them |
| Local / OpenAI-compatible / Anthropic-compatible nodes                | Chat / image / video / upscale / music for leftover ids return **410** | —                                                                |
| Native `tools` / `tool_calls` from upstream APIs                      | Bulk web-session import and cookie browser-login routes are gone       | —                                                                |
| Existing SQLite data; leftover cookie rows stay until operator delete | Detection uses hardcoded sunset ids (`poe-web`, not official `poe`)    | —                                                                |
| GitLab Duo `webTools.ts`                                              | Official PAT/OAuth GitLab Duo still uses `webTools`                    | Do not treat `webTools` as a cookie-chat feature                 |
| Playwright for e2e and official OAuth PKCE/device-code                | Cookie Playwright login / browserPool deleted                          | —                                                                |

Deleted executors no longer exist on disk. Fail-closed stays at `resolveExecutorWithProxy` and media handlers (`sunsetProviderFromModelString`) so leftover traffic cannot fall through to `DefaultExecutor` / OpenAI.

## Rules (binding now)

1. **Do not add** a new web-cookie / website-session provider, executor, or credential flavor.
2. **Do not expand** `webTools.ts` emulation, browser-backed chat, or cookie anti-bot work except to fix a security or data-loss bug on the inherited path.
3. **Do not advertise** cookie sources as capable of native local-tool agent loops. Clients that need tools should use API-key or OAuth connections.
4. **Prefer deletion over flags.** Do not re-enable cookie listing with a permanent dual catalog.
5. Cookie **connection rows stay in SQLite**. Do not silently wipe credentials. Leftover rows are inert: they are omitted from `/v1/models` and fail closed on chat/media.

## Operator migration

Replace leftover website-session connections with the matching official source, then delete the cookie row:

| Leftover cookie id                                                                      | Switch to                                                                                                        |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `chatgpt-web`                                                                           | OpenAI API key or Codex OAuth                                                                                    |
| `claude-web`                                                                            | Anthropic API key or Claude Code OAuth                                                                           |
| `gemini-web`                                                                            | Google AI API key or Antigravity / Gemini OAuth                                                                  |
| `grok-web`                                                                              | xAI API key or Grok CLI / xAI OAuth                                                                              |
| `kimi-web`                                                                              | `moonshot` API key or `kimi-coding` OAuth                                                                        |
| `qwen-web`                                                                              | Qwen Cloud / DashScope API key                                                                                   |
| `poe-web`                                                                               | official `poe` API key                                                                                           |
| `v0-vercel-web`                                                                         | official `v0-vercel` API key                                                                                     |
| other `*-web` / `huggingchat` / `lmarena`                                               | the matching API-key, OAuth, or compatible-node provider                                                         |
| `duckduckgo-web` / `felo-web` / `theoldllm` / `chipotle` / `veoaifree-web` / `mimocode` | official API-key, OAuth, no-auth (`auggie` / `aihorde` / `opencode` / `devin-cli-agentic`), or a compatible node |
| `suno` / `udio` cookie music                                                            | official music API-key nodes (e.g. KIE / MiniMax), not Clerk/Supabase cookies                                    |

Clients that still request `chatgpt-web/...` (or a cookie-only alias such as `cgpt-web`) receive **HTTP 410** with:

`Web-cookie / website-session providers are sunset in OmniRoute Tiny. Use an official API-key, OAuth, or compatible-node connection instead.`

Detection is by **canonical cookie id**. Official aliases that collide with cookie nicknames (`poe`, `v0`, `hc`) stay live.

## Remaining deletion

1. Source deletion is done: cookie catalog, website-backed executors, media stubs, browser-pool / VNC cookie login, cookie validators, and cookie credential helpers are gone.
2. Leftover i18n cookie-hint strings may remain until a copy sweep; they are unused.
3. Operator-delete leftover SQLite cookie rows after migration. Do not silently wipe them.

## Non-goals

- Not a ban on **browser OAuth login** (PKCE / device-code popups) for official APIs.
- Not a ban on **operator HTTP/SOCKS egress proxies**.
- Not a requirement to delete cookie source in the same change as the product cut.
- Source deletion is complete for unofficial website-backed executors. Official Playwright OAuth and GitLab `webTools` remain.
- Not a promise that Tiny will keep `webTools` emulation.

## Consequences

Tiny's gateway contract is official credentials + native protocol. Cookie replay is out of scope. Operators who only had website sessions must switch to API keys or OAuth, or those models disappear from the proxy.
