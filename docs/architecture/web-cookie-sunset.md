---
title: "ADR: Sunset web-cookie providers in OmniRoute Tiny"
status: accepted
lastUpdated: 2026-08-25
---

# ADR: Sunset web-cookie providers in OmniRoute Tiny

- **Status:** Accepted for OmniRoute Tiny. Runtime removal has not started.
- **Scope:** Product/architecture direction. This document does not delete providers, executors, or stored connections.

## Context

OmniRoute Tiny is a self-hosted aggregation gateway. It should expose a stable OpenAI-compatible (and sibling) API over **official, durable credentials**: API keys, OAuth, and local/compatible nodes.

The inherited tree still includes **web-cookie** providers (`src/shared/constants/providers/web-cookie.ts`, ~31 catalog entries). Those connections authenticate with a pasted browser session (Cookie header, `__Secure-*` tokens, `cf_clearance`, localStorage tokens, etc.) and replay reverse-engineered website chat endpoints.

That path can be hung off `/v1` as a proxy. Local client tools can sometimes run if an executor prompt-emulates `tools[]` via `open-sse/translator/webTools.ts` and parses `<tool>` / `<tool_call>` text back into `tool_calls`. That is not native function calling. It is also not the contract Tiny wants to keep:

- Website chat UIs typically have no first-class tools protocol; emulation is best-effort and silently degrades to prose.
- Sessions expire, bind to IP / User-Agent / TLS fingerprint, and require Playwright / Chromium / VNC helpers.
- Catalog, validation, quota, and anti-bot work is large, unofficial, and ToS-hostile relative to a gateway.
- Tiny's retained surface is OAuth + API-key connections, native streaming, and real tool/reasoning protocols.

## Decision

After the current Tiny gateway cutover is stable, **remove web-cookie as a first-class provider class**.

| Keep                                                                 | Remove (target)                                                                      |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| API-key providers                                                    | `WEB_COOKIE_PROVIDERS` catalog and add-connection UI                                 |
| OAuth providers (Claude Code, Codex, Cursor, Antigravity, …)         | Cookie-session executors (`*-web`, `huggingchat`, `lmarena`, …)                      |
| Local / OpenAI-compatible / Anthropic-compatible nodes               | `webTools.ts` prompt-emulation as a supported agent path                             |
| Native `tools` / `tool_calls` from upstream APIs                     | Browser pool, Turnstile, VNC/noVNC cookie login, runner-web Chromium for cookie chat |
| Existing SQLite data; cookie rows become inert then operator-deleted | New cookie providers, cookie-only media bridges, and cookie ToS-workaround features  |

Until the removal PR, inherited cookie code may remain so existing installs do not break mid-cutover. It is **legacy, not a Tiny feature**.

## Rules (binding now)

1. **Do not add** a new web-cookie / website-session provider, executor, or credential flavor.
2. **Do not expand** `webTools.ts` emulation, browser-backed chat, or cookie anti-bot work except to fix a security or data-loss bug on the inherited path.
3. **Do not advertise** cookie sources as capable of native local-tool agent loops. Clients that need tools should use API-key or OAuth connections.
4. **Prefer deletion over flags.** A temporary “hide cookie providers” build flag is allowed only as a short migration step, not as a permanent dual catalog.
5. Cookie **connection rows stay in SQLite** until an explicit removal/migration PR. Do not silently wipe credentials.

## Removal sequence (later PR)

1. Stop listing cookie providers in Dashboard add-provider and `/v1/models` for new connections.
2. Reject new cookie connection creates; existing rows keep serving or fail closed with a documented error.
3. Delete cookie executors, `web-cookie.ts` catalog, `webTools` call sites, browser-pool / VNC cookie login, and runner-web Chromium if nothing else needs it.
4. Document operator migration: replace `chatgpt-web` / `gemini-web` / `claude-web` / … with the matching API-key or OAuth provider; delete leftover cookie rows.
5. Drop Playwright/Chromium from the default Tiny image if cookie chat was the only consumer.

Each step is a separate, reviewable change. This ADR does not schedule a version number.

## Non-goals

- Not a ban on **browser OAuth login** (PKCE / device-code popups) for official APIs.
- Not a ban on **operator HTTP/SOCKS egress proxies**.
- Not a requirement to delete cookie source in the same commit as this document.
- Not a promise that Tiny will keep `webTools` emulation until removal day.

## Consequences

Tiny's gateway contract is official credentials + native protocol. Cookie replay is out of scope. Image size, executor count, and unofficial-site maintenance should fall when the removal PR lands. Operators who only had website sessions must switch to API keys or OAuth before that PR, or those models disappear from the proxy.
