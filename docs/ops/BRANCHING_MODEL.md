---
title: "Branching & Release Model"
lastUpdated: 2026-08-13
---

`main` is the Release Please target and the authoritative release line. Feature and fix branches
open pull requests against `main`. Conventional Commit titles determine generated release notes and
semantic-version bumps.

```mermaid
flowchart LR
  A["Feature or fix branch"] --> B["Pull request to main"]
  B --> C["Merge to main"]
  C --> D["Release Please PR"]
  D --> E["Merge release PR"]
  E --> F["vX.Y.Z tag and GitHub Release"]
  F --> G["Docker publication from tagged commit"]
```

Release Please is the only process allowed to create version commits, update `CHANGELOG.md`, create
release tags, or create GitHub Releases. Legacy per-version release branches, release-freeze issues,
manual version-bump flows, and parallel-cycle synchronization are not part of the active model.

Related documents:

- [CONTRIBUTING.md](../../CONTRIBUTING.md)
- [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)
- [RELEASE_GREEN.md](./RELEASE_GREEN.md)
