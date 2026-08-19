import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const ENTRYPOINT = path.join(REPO_ROOT, "scripts/check-permissions.sh");

test("Docker images omit qodercli and Compose exposes persistent opt-in installation", () => {
  const dockerfile = fs.readFileSync(path.join(REPO_ROOT, "Dockerfile"), "utf8");
  const compose = fs.readFileSync(path.join(REPO_ROOT, "docker-compose.yml"), "utf8");
  const productionCompose = fs.readFileSync(
    path.join(REPO_ROOT, "docker-compose.prod.yml"),
    "utf8"
  );

  assert.doesNotMatch(dockerfile, /npm install[^\n]*@qoder-ai\/qodercli/);
  for (const source of [compose, productionCompose]) {
    assert.match(source, /QODER_CLI_AUTO_INSTALL=\$\{QODER_CLI_AUTO_INSTALL:-false\}/);
    assert.match(source, /QODER_CLI_INSTALL_DIR=\/app\/data\/qoder-cli-runtime/);
    assert.match(source, /\/app\/data/);
  }
});

function writeExecutable(file: string, source: string): void {
  fs.writeFileSync(file, source, { mode: 0o755 });
}

test("Docker entrypoint installs qodercli into the persistent runtime directory when opted in", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-qoder-install-"));
  const fakeBin = path.join(root, "bin");
  const installDir = path.join(root, "runtime");
  fs.mkdirSync(fakeBin);
  writeExecutable(
    path.join(fakeBin, "npm"),
    `#!/bin/sh
set -eu
prefix=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--prefix" ]; then prefix="$2"; shift 2; continue; fi
  shift
done
mkdir -p "$prefix/bin"
cat > "$prefix/bin/qodercli" <<'EOF'
#!/bin/sh
echo qodercli-test
EOF
chmod +x "$prefix/bin/qodercli"
`
  );

  try {
    const result = spawnSync(
      ENTRYPOINT,
      ["sh", "-c", 'printf "%s\\n%s\\n" "$CLI_QODER_BIN" "$(command -v qodercli)"'],
      {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${fakeBin}:/usr/bin:/bin`,
          DATA_DIR: path.join(root, "data"),
          QODER_CLI_AUTO_INSTALL: "true",
          QODER_CLI_INSTALL_DIR: installDir,
        },
      }
    );

    assert.equal(result.status, 0, result.stderr);
    const expected = path.join(installDir, "bin", "qodercli");
    assert.deepEqual(result.stdout.trim().split("\n").slice(-2), [expected, expected]);
    assert.equal(fs.existsSync(expected), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Docker entrypoint reuses a persisted qodercli without invoking npm", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-qoder-reuse-"));
  const fakeBin = path.join(root, "bin");
  const installDir = path.join(root, "runtime");
  const qoderBin = path.join(installDir, "bin", "qodercli");
  const npmCalled = path.join(root, "npm-called");
  fs.mkdirSync(fakeBin);
  fs.mkdirSync(path.dirname(qoderBin), { recursive: true });
  writeExecutable(qoderBin, "#!/bin/sh\necho persisted\n");
  writeExecutable(path.join(fakeBin, "npm"), `#!/bin/sh\ntouch "${npmCalled}"\nexit 1\n`);

  try {
    const result = spawnSync(ENTRYPOINT, ["sh", "-c", 'printf "%s" "$CLI_QODER_BIN"'], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${fakeBin}:/usr/bin:/bin`,
        DATA_DIR: path.join(root, "data"),
        QODER_CLI_AUTO_INSTALL: "true",
        QODER_CLI_INSTALL_DIR: installDir,
      },
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.endsWith(qoderBin), true);
    assert.equal(fs.existsSync(npmCalled), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
