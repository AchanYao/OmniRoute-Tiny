# Tech Debt

Tracked capability mismatches and catalog-vs-executor drift. P0 < 30 d, P1 < 90 d.

## Open

### P1 — grok-cli drops catalog-advertised reasoning efforts

- **Opened:** 2026-08-27
- **Providers:** `grok-cli` / `gc` (`grok-4.6`, `grok-4.5`)
- **Symptom:** `/v1/models` advertises `effort_tiers` including `xhigh` / `none` / `minimal` (from authenticated Grok Build discovery). The executor allowlist is hardcoded `low|medium|high`, so OMP `:xhigh` / `:minimal` / `:none` are silently stripped. `grok-4.5` with no effort still injects `high`, ignoring discovered `defaultThinkingEffort`.
- **Source:**
  - Discovery already parses upstream `reasoning_efforts` / `defaultThinkingEffort`: `src/app/api/providers/[id]/models/discovery/providerModelsConfig.ts` (`getGrokBuildThinkingEfforts`, `GROK_BUILD_PREFERRED_EFFORTS`)
  - Executor ignores that: `open-sse/executors/grok-cli.ts` (`GROK_BUILD_SUPPORTED_REASONING_EFFORTS`, `normalizeGrokBuildReasoning`)
  - Default `high` constant: `open-sse/config/grokBuild.ts` (`GROK_BUILD_DEFAULT_REASONING_EFFORT`)
- **Verified:** Docker `omniroute` 2026-08-27. Live `gc/grok-4.6` catalog `["none","low","medium","high","xhigh"]`. Probe: inbound `effort=xhigh|minimal` → outbound effort deleted; `medium|low` forwarded. Empty `grok-4.5` body still gets `reasoning.effort=high`.
- **Fix:** Drive the allowlist (and 4.5 default) from the discovered model record / last-successful catalog, not a source Set. Unknown values: pass through or map, do not drop.

### P1 — xAI family hardcodes which models may carry `reasoning_effort`

- **Opened:** 2026-08-27
- **Providers:** `xai-oauth` / `xao` (`grok-4.3`; suffix routing for other grok ids)
- **Symptom:** Authenticated `https://api.x.ai/v1/models` discovery is migrated, but `XaiExecutor` only maps `-{low,medium,high,xhigh}` suffixes onto `reasoning_effort` for `REASONING_ALLOWED = ["grok-4.3", "grok-4.20-0309-reasoning"]`. New discovered ids (e.g. `grok-4.5` / `grok-4.6` on this executor) lose the suffix effort. Chat-path `normalizeXaiReasoningEffort` is a second hardcoded set `minimal|low|medium|high` and remaps `xhigh|max` → `high`.
- **Source:**
  - `open-sse/executors/xai.ts` (`REASONING_ALLOWED`, `REASONING_DENIED`, `EFFORT_SUFFIXES`)
  - `src/lib/providers/xai/thinking.ts` (`VALID_EFFORTS`)
- **Fix:** Classify allow/deny from discovered model capabilities (`supportsReasoning` / `effort_tiers`), not a static id list. Keep suffix stripping; populate `reasoning_effort` whenever the discovered model accepts it.

### P1 — Antigravity catalog hides configurable thinking for the provider

- **Opened:** 2026-08-27
- **Providers:** `antigravity` (`gemini-3.7-flash-tiered`; Claude models on the same connection still leak tiers via other paths)
- **Symptom:** `getThinkingCapabilityFields` sets `exposesConfigurableEffort = providerId !== "antigravity"`, so Gemini-on-Antigravity publishes `supportsThinking: false` / no `effort_tiers` even when the model is a thinking SKU (`gemini-3.7-flash-tiered`). Executor also strips root `thinking` / `reasoning_effort` / `thinking_budget` before the Cloud Code envelope is built.
- **Source:**
  - `src/app/api/v1/models/catalogHelpers.ts` (`getThinkingCapabilityFields`)
  - `open-sse/executors/antigravity.ts` (root-field destructure drop)
- **Live:** Docker 2026-08-27 `antigravity/gemini-3.7-flash-tiered` → `effort_tiers: null`, `supportsThinking: false`. Claude ids on the same provider still show `effort_tiers` (synced/override path).
- **Fix:** Advertise thinking from discovered/synced capabilities, not a provider-id denylist. Stop dropping root thinking fields when the target model supports them.

## Related (not the same bug; do not treat as grok-cli clones)

| Provider / model you use                                                     | Hardcode?                         | Notes                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `seefs` (`gpt-5.6-sol`, `gpt-5.4`, `gpt-5.4-mini`)                           | No executor allowlist             | OpenAI-compatible Responses node. Catalog already publishes `effort_tiers` including `xhigh`. Codex `MAX_EFFORT_BY_MODEL` / `ultra` remap does **not** run on this node.                                                    |
| `qwen-cloud-token-plan` (`glm-5.2`, `deepseek-v4-flash-0731`, `qwen3.8-max`) | Shared sanitizer, not a local Set | `sanitizeReasoningEffortForProvider` keys off provider id (`deepseek`, `nvidia` GLM). On this provider, DeepSeek `max` may become `xhigh`; NVIDIA-style GLM `enable_thinking` mapping does not run. Pass-through otherwise. |
| Codex `gpt-5.6-sol` (if routed via `codex`, not `seefs`)                     | Model-cap table                   | `open-sse/executors/codex.ts` `MAX_EFFORT_BY_MODEL` — caps, does not drop unknown catalog tiers the way grok-cli does.                                                                                                      |
| `grok-cli` composer                                                          | Intentional                       | `grok-composer-2.5-fast` always strips effort. Not catalog drift.                                                                                                                                                           |

## Closed

_None yet._
