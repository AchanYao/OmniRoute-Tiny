/**
 * Cheaper Inference image provider registry entry.
 * Extracted into its own module to keep open-sse/config/imageRegistry.ts
 * under the file-size cap (god-file decomposition; semantic split) — same
 * pattern as FREEPIK_IMAGE_PROVIDER / SEGMIND_IMAGE_PROVIDER.
 *
 * 3 image models measured from GET /v1/models?type=image on 2026-07-31.
 *
 * Models are reachable as `cheaperinference/<id>` / `cinf/<id>`. Bare
 * nano-banana ids are not aliases.
 *
 * The endpoint ignores `response_format:"url"` and always returns `b64_json`
 * (measured twice). The OpenAI image path already handles b64_json; this is not a
 * bug to "fix". /v1/images/edits returns 404 upstream, so no edit support.
 */
export const CHEAPERINFERENCE_IMAGE_PROVIDER = {
  id: "cheaperinference",
  alias: "cinf",
  baseUrl: "https://api.cheaperinference.com/v1/images/generations",
  authType: "apikey",
  authHeader: "bearer",
  format: "openai",
  models: [
    { id: "grok-imagine", name: "Grok Imagine (Cheaper Inference)" },
    { id: "nano-banana-pro", name: "Nano Banana Pro (Cheaper Inference)" },
    { id: "nano-banana-2", name: "Nano Banana 2 (Cheaper Inference)" },
  ],
  supportedSizes: ["1024x1024", "2048x2048", "4096x4096"],
};
