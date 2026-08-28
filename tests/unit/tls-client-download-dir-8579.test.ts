import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

const TLS_CLIENT_MODULES = ["open-sse/services/tlsClientDownloadDir.ts"] as const;

const originalDataDir = process.env.DATA_DIR;

afterEach(() => {
  if (originalDataDir === undefined) {
    delete process.env.DATA_DIR;
  } else {
    process.env.DATA_DIR = originalDataDir;
  }
});

test("resolveTlsClientDownloadDir caches native binary under DATA_DIR/tls-client/bin (#8579)", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "omniroute-tls-client-8579-"));
  process.env.DATA_DIR = dataDir;

  const { resolveTlsClientDownloadDir } =
    await import("../../open-sse/services/tlsClientDownloadDir.ts");

  assert.equal(resolveTlsClientDownloadDir(), join(dataDir, "tls-client", "bin"));
});

test("buildNativeTlsClientOptions passes downloadDir to tls-client-node (#8579)", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "omniroute-tls-client-opts-8579-"));
  process.env.DATA_DIR = dataDir;

  const { buildNativeTlsClientOptions } =
    await import("../../open-sse/services/tlsClientDownloadDir.ts");

  const options = buildNativeTlsClientOptions();

  assert.equal(options.runtimeMode, "native");
  assert.equal(options.downloadDir, join(dataDir, "tls-client", "bin"));
});

test("all web-provider tls clients wire downloadDir through buildNativeTlsClientOptions (#8579)", () => {
  const source = readFileSync(join(ROOT, "open-sse/services/tlsClientDownloadDir.ts"), "utf8");
  assert.match(source, /export function buildNativeTlsClientOptions/);
});
