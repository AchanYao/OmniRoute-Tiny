---
title: "OmniRoute Roadmap"
version: 3.8.50
lastUpdated: 2026-08-25
---

> Version-gated, not date-gated: each milestone ships when its quality gates pass.
> Current line: **v3.8.x** (this branch). Last updated: 2026-07-23.

## OmniRoute Tiny

This repository is **OmniRoute Tiny**, an independent gateway fork. The 3.8 → 4.0
modular-platform rail below is inherited upstream history, not Tiny's delivery plan.

Tiny direction: keep the aggregation gateway (OAuth / API key / compatible nodes),
then **sunset web-cookie / website-session providers**. Do not add cookie sources.
See [`docs/architecture/web-cookie-sunset.md`](architecture/web-cookie-sunset.md).
Runtime removal is a later PR; this is the accepted product decision.

OmniRoute is heading from a monolithic router to a **modular AI platform**: a lightweight
core engine, a typed SDK, and everything else as installable modules and plugins. The path
runs through a stabilization rail (3.8.50 → 3.8.59), an LTS anchor (**3.9.0**), and the
modular **4.0**.

## The rail at a glance

```
3.8.50 ─ 3.8.54   PREPARE   non-breaking structural prep (all PRs welcome)
3.8.55 ─ 3.8.59   VALIDATE  stabilization (fixes / docs / i18n / providers only)
3.9.0             LTS       stable/v3 branch · long-term support line
4.0.0-nightly/rc  MODULAR   core + SDK + modules + marketplace (develop branch)
4.0.0             GA        latest switches to v4 · v3 stays supported as LTS
```

## Phase 1 — Preparation (3.8.50 → 3.8.54)

Non-breaking structural work that de-risks the modular split. Every version closes with a
mandatory quality-gate battery before new merges open.

| Version | Focus                                                                                                                                                                                                           |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.8.50  | CI safety net on release branches · dead-code cleanup · community-reported catalog/topology bug fixes · contributor "golden path" guide                                                                         |
| 3.8.51  | Executor registry (in-place) · end-to-end provider-journey contract test becomes a CI gate · official scoped-test dev loop · CI lane consolidation (shared install/setup across gate jobs, #8084)               |
| 3.8.52  | `combo.ts` decomposition · routing-strategy registry · unified model-catalog contract for `/v1/models` · one CI policy for PRs to `release/**` and `main` (#8084)                                               |
| 3.8.53  | `chatCore.ts` decomposition · headless mode (`OMNIROUTE_HEADLESS=1`) · local candidate build/promote loop                                                                                                       |
| 3.8.54  | Release infrastructure (dormant): channels, labels, PR templates, merge queue · full-regression authority moves to the merge queue once TIA shadow evidence clears (#8084) · public feature-freeze announcement |

## Phase 2 — Validation (3.8.55 → 3.8.59)

**External feature PRs pause here** (they get the `v4-feature` label and are re-targeted to
the v4 channel when it opens). Fixes, docs, i18n, and provider updates keep flowing.

| Version | Focus                                                                                                                                        |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.8.55  | Characterization tests for every extraction candidate · coupling re-measurement                                                              |
| 3.8.56  | Extended canary · performance baselines (heap, TTFB, build)                                                                                  |
| 3.8.57  | Security & compliance sweep · publish provenance (OIDC) rehearsal                                                                            |
| 3.8.58  | Full dry-run of the 3.9.0 cut (branches, channels, forward-port) — includes the PR preview-artifact + build-once promotion rehearsal (#8084) |
| 3.8.59  | Final freeze · full-suite audit · GO/NO-GO                                                                                                   |

## Ongoing provider model-catalog migration

Provider model availability is moving out of source-controlled registry arrays and into
authenticated upstream discovery. This is an incremental maintenance rule, not a release-blocking
flag-day migration: migrate a provider when it is otherwise being changed and has a trustworthy
discovery source.

For a migrated provider:

1. Discover models per connection from an authenticated provider endpoint or equivalent official
   source.
2. Persist the last successful result in `syncedAvailableModels`, scoped by provider and connection.
3. Publish the union for active connections through `/v1/models`.
4. Preserve the last successful catalog when later discovery fails; never replace it with a
   degraded local fallback or accidental empty response.
5. Publish no models before the first successful discovery unless the provider has an explicitly
   documented static-only fallback.
6. Treat `passthroughModels` only as permission to route an explicit unknown model ID, not as a
   source of catalog entries.

Static registry data may remain for transport, authentication, endpoint selection, provider-wide
unsupported parameters, and narrowly scoped capability overrides. It may enrich discovered models,
but must not assert availability. Providers without a reliable discovery source remain static until
one exists.

When migrating a provider, verify authenticated discovery and normalization, persistence across
temporary failures and restarts, active-connection union/removal semantics, capability preservation,
and explicit prefixed and bare-ID routing independently from catalog publication.

| Provider                | Discovery source                                                   | Status   | Notes                                             |
| ----------------------- | ------------------------------------------------------------------ | -------- | ------------------------------------------------- |
| `codex`                 | Authenticated Codex API, official GitHub fallback, persisted cache | Migrated | Reference implementation                          |
| `grok-cli` (Grok Build) | Authenticated Grok Build models endpoint                           | Migrated | Responses-only models normalized during discovery |
| `xai-oauth`             | Authenticated `https://api.x.ai/v1/models`                         | Migrated | Connection-scoped OAuth discovery                 |
| `antigravity`           | Per-connection Import / Sync (`syncedAvailableModels`)             | Partial  | Still falls back to `ANTIGRAVITY_PUBLIC_MODELS`   |

### Known gap — static catalog as availability source

Observed 2026-08-25 on a live Antigravity install (OMP key `/v1/models`):

- Dashboard Import writes `syncedAvailableModels` per connection. `/v1/models` only
  publishes the **active-connection** union (`getAllActiveSyncedModels()`).
- If the active connection has no synced row, catalog emission falls back to the
  static registry (`ANTIGRAVITY_PUBLIC_MODELS`). Models that exist upstream or were
  imported on another connection — e.g. `gemini-3.7-flash-tiered` — never appear.
- Catalog-driven clients (OMP discovery / role models) can only pick advertised
  ids. A model missing from that static list is effectively unusable even when
  `passthroughModels` would accept an explicit request.
- Importing on the active account is a workaround, not a fix. The same class
  applies to any provider that still treats the static registry as the source of
  availability instead of last-successful live discovery.

Follow-up: finish the catalog-migration contract for `antigravity` (and peers still
on static fallback) so `/v1/models` publishes the active live catalog, not the
source-controlled public list, and never hides an imported id just because it is
absent from `ANTIGRAVITY_PUBLIC_MODELS`.

## Gateway settings backlog

### Standalone model capability overrides page

- Add a dedicated model capability overrides route that is retained in Gateway Edition instead
  of restoring the excluded `/dashboard/settings/ai` page.
- Reuse the existing `ModelCapabilityOverridesTab` behavior and
  `/api/model-capability-overrides`; do not duplicate override storage or resolution logic.
- Include registry, manually added, and upstream `/models`-synced models in the selectable
  catalog so Gateway operators can configure every advertised model.
- Add the page to Gateway navigation and keep memory, skills, and the other intentionally excluded
  AI settings out of the Gateway build.
- Verify both full and Gateway build profiles: the route renders, an override can be saved and
  removed, and a synced model remains selectable after restart.

## Phase 3 — v3.9.0 LTS

After 3.8.59 the next version is **3.9.0** (there is no 3.8.60). It creates the long-lived
branch model:

- **`stable/v3`** — the LTS line (3.9.x). Receives fixes, security patches, and provider
  updates. `npm install omniroute` (aka `latest`) stays on v3 during the whole v4 cycle.
- **`develop`** — v4 development, published as `4.0.0-nightly.*`.
- **`main`** — v4 release candidates (`next`) and, eventually, GA.
- Fixes merged to `stable/v3` are automatically forward-ported to `develop` with full
  contributor credit (`Co-authored-by`).

New features land in the v4 channel. The LTS line is stability-first.

## Phase 4 — v4.0: the modular platform

The monolith is intentionally disassembled on `develop`:

- **`@omniroute/core`** (npm name stays `omniroute`) — just the engine: `/v1/*`, routing,
  combo/fallback, providers.
- **`@omniroute/sdk`** — one typed contract: hooks, extension points, two-phase lifecycle,
  UI contributions. The five extension systems that exist today (plugins, CLI plugins,
  skills, MCP tools, A2A skills) collapse into one declarative manifest.
- **Modules** (`@omniroute/mod-*`) — cloud agents, traffic inspection (MITM), evals,
  webhooks, memory, guardrails, observability and more move out of the core, each with its
  own version and lifecycle.
- **Providers as plugins** — adding a provider stops touching the core.
- **Marketplace** — one-click install with verified integrity (hash pinning, signing,
  sandbox). Free in v1; a paid tier later with revenue share for creators.
- Ships as `4.0.0-nightly.*` → `4.0.0-rc.N` (soak in production) → **4.0.0 GA**, when
  `latest` switches to v4 and v3 enters its announced LTS support window.

**The core is MIT and free, forever.**

## For contributors

| You are sending... | Target today            | From 3.8.55                  | After 3.9.0    |
| ------------------ | ----------------------- | ---------------------------- | -------------- |
| Bug fix / security | active `release/v3.8.x` | same                         | `stable/v3`    |
| Provider update    | active `release/v3.8.x` | same                         | `stable/v3`    |
| Docs / i18n        | active `release/v3.8.x` | same                         | `stable/v3`    |
| New feature        | active `release/v3.8.x` | held with `v4-feature` label | `develop` (v4) |

See `CONTRIBUTING.md` for the golden path per change type.
