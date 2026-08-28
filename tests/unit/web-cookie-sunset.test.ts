import test from "node:test";
import assert from "node:assert/strict";

import { APIKEY_PROVIDERS } from "../../src/shared/constants/providers/apikey/index.ts";
import { NOAUTH_PROVIDERS } from "../../src/shared/constants/providers/noauth.ts";
import {
  WEB_COOKIE_SUNSET_ERROR,
  WEB_COOKIE_SUNSET_STATUS,
  isSunsetWebCookieChatTarget,
  isSunsetWebCookieExecutorAlias,
  isSunsetWebCookieProviderId,
  sunsetProviderFromModelString,
  webCookieSunsetError,
} from "../../src/shared/providers/webCookieSunset.ts";
import { isManagedProviderConnectionId } from "../../src/lib/providers/catalog.ts";
import { resolveExecutorWithProxy } from "../../open-sse/handlers/chatCore/executorProxy.ts";
import { handleImageGeneration } from "../../open-sse/handlers/imageGeneration.ts";
import { handleMusicGeneration } from "../../open-sse/handlers/musicGeneration.ts";
import { handleVideoGeneration } from "../../open-sse/handlers/videoGeneration.ts";

test("canonical website-session ids are sunset; official poe / v0 / hackclub are not", () => {
  assert.equal(isSunsetWebCookieProviderId("chatgpt-web"), true);
  assert.equal(isSunsetWebCookieProviderId("grok-web"), true);
  assert.equal(isSunsetWebCookieProviderId("poe-web"), true);
  assert.equal(isSunsetWebCookieProviderId("duckduckgo-web"), true);
  assert.equal(isSunsetWebCookieProviderId("theoldllm"), true);
  assert.equal(isSunsetWebCookieProviderId("chipotle"), true);
  assert.equal(isSunsetWebCookieProviderId("mimocode"), true);
  assert.equal(isSunsetWebCookieProviderId("suno"), true);
  assert.equal(isSunsetWebCookieProviderId("udio"), true);
  assert.equal(isSunsetWebCookieProviderId("poe"), false);
  assert.equal(isSunsetWebCookieChatTarget("poe"), false);
  assert.equal(isSunsetWebCookieChatTarget("v0"), false);
  assert.equal(isSunsetWebCookieExecutorAlias("hc"), false);
  assert.equal("poe" in APIKEY_PROVIDERS, true);
  assert.equal("v0-vercel" in APIKEY_PROVIDERS, true);
  assert.equal("hackclub" in APIKEY_PROVIDERS, true);
  assert.equal("chatgpt-web" in NOAUTH_PROVIDERS, false);
  assert.equal("duckduckgo-web" in NOAUTH_PROVIDERS, false);
  assert.equal("auggie" in NOAUTH_PROVIDERS, true);
  assert.equal("aihorde" in NOAUTH_PROVIDERS, true);
});

test("cookie-only executor aliases are sunset; colliding official ids are not", () => {
  assert.equal(isSunsetWebCookieExecutorAlias("cgpt-web"), true);
  assert.equal(isSunsetWebCookieExecutorAlias("gweb"), true);
  assert.equal(isSunsetWebCookieChatTarget("cgpt-web"), true);
  assert.equal(isSunsetWebCookieChatTarget("copilot"), true);
  assert.equal(isSunsetWebCookieChatTarget("ddgw"), true);
  assert.equal(isSunsetWebCookieExecutorAlias("poe"), false);
  assert.equal(isSunsetWebCookieExecutorAlias("hc"), false);
  assert.equal(isSunsetWebCookieExecutorAlias("v0"), false);
});

test("sunsetProviderFromModelString extracts sunset prefixes and ignores official poe", () => {
  assert.equal(sunsetProviderFromModelString("chatgpt-web/gpt-4o"), "chatgpt-web");
  assert.equal(sunsetProviderFromModelString("suno/chirp-v4"), "suno");
  assert.equal(sunsetProviderFromModelString("poe/something"), null);
  assert.equal(sunsetProviderFromModelString("poe"), null);
  assert.equal(sunsetProviderFromModelString(""), null);
  assert.equal(sunsetProviderFromModelString(null), null);
});

test("managed catalog no longer accepts website-session connections", () => {
  assert.equal(isManagedProviderConnectionId("chatgpt-web"), false);
  assert.equal(isManagedProviderConnectionId("grok-web"), false);
  assert.equal(isManagedProviderConnectionId("poe-web"), false);
  assert.equal(isManagedProviderConnectionId("duckduckgo-web"), false);
  assert.equal(isManagedProviderConnectionId("theoldllm"), false);
  assert.equal(isManagedProviderConnectionId("poe"), true);
  assert.equal(isManagedProviderConnectionId("synthetic"), true);
  assert.equal(isManagedProviderConnectionId("auggie"), true);
});

test("chat dispatch fail-closes website-session providers instead of DefaultExecutor", async () => {
  await assert.rejects(
    () => resolveExecutorWithProxy("chatgpt-web"),
    (err: Error & { status?: number }) => {
      assert.equal(err.message, WEB_COOKIE_SUNSET_ERROR);
      assert.equal(err.status, WEB_COOKIE_SUNSET_STATUS);
      return true;
    }
  );
  await assert.rejects(() => resolveExecutorWithProxy("cgpt-web"), /sunset/i);
  await assert.rejects(() => resolveExecutorWithProxy("duckduckgo-web"), /sunset/i);
  await assert.doesNotReject(() => resolveExecutorWithProxy("poe"));
});

test("webCookieSunsetError is a documented 410", () => {
  const err = webCookieSunsetError();
  assert.equal(err.message, WEB_COOKIE_SUNSET_ERROR);
  assert.equal(err.status, 410);
});

test("website-session image and video handlers fail closed with 410", async () => {
  const image = await handleImageGeneration({
    body: { model: "chatgpt-web/gpt-4o", prompt: "a kitten" },
    credentials: { apiKey: "sess" },
    log: null,
  });
  assert.equal(image.success, false);
  assert.equal(image.status, WEB_COOKIE_SUNSET_STATUS);
  assert.equal(image.error, WEB_COOKIE_SUNSET_ERROR);

  const video = await handleVideoGeneration({
    body: { model: "adobe-firefly/firefly-video" },
    credentials: { apiKey: "ims" },
    log: null,
  });
  assert.equal(video.success, false);
  assert.equal(video.status, WEB_COOKIE_SUNSET_STATUS);
});

test("website-session music handler fail-closes suno with 410", async () => {
  const music = await handleMusicGeneration({
    body: { model: "suno/chirp-v4" },
    credentials: { apiKey: "sess" },
    log: null,
  });
  assert.equal(music.success, false);
  assert.equal(music.status, WEB_COOKIE_SUNSET_STATUS);
  assert.equal(music.error, WEB_COOKIE_SUNSET_ERROR);
});
