---
title: "Release Checklist"
version: 3.8.50
lastUpdated: 2026-08-13
---

Release Please is the sole authority for version changes, release notes, tags, and GitHub Releases.

## Before merging the release PR

- [ ] Confirm the Release Please PR targets `main`.
- [ ] Confirm its version matches the intended semantic-version bump derived from Conventional
      Commits.
- [ ] Confirm `package.json`, `package-lock.json`, `electron/package.json`,
      `electron/package-lock.json`, and `open-sse/package.json` carry the same version.
- [ ] Review the generated `CHANGELOG.md` section. Do not maintain separate fragments or edit the
      release tag manually.
- [ ] Run the required quality and coverage gates.
- [ ] Build the Docker artifact from the release candidate and smoke-test its health endpoint and a
      representative model request.

## Publishing

1. Merge the Release Please PR.
2. Let `.github/workflows/release-please.yml` create the `vX.Y.Z` tag and GitHub Release.
3. Let the Docker publication workflow build from that exact tag.
4. Confirm immutable semver tags and the intended moving channel tag resolve to the published
   digest.

Never create the version commit, tag, changelog section, or GitHub Release manually while Release
Please is active.

## Post-release

- [ ] Confirm the GitHub Release points at the expected commit.
- [ ] Confirm the Docker image is healthy on every published architecture.
- [ ] Confirm persisted data survives an image replacement.
- [ ] Exercise `/api/monitoring/health`, `/v1/models`, and one authenticated inference request.
- [ ] Attach Electron artifacts to the existing GitHub Release when applicable; do not create a
      second release.
