---
name: deployment-workflow
description: How agentsync gets built and (eventually) published.
source: authored
priority: 60
applies_to: ["*"]
tags: [workflow, deployment]
---

# Deployment workflow

## Build

```sh
pnpm install                                         # workspace + sub-package deps
pnpm run build                                       # main CLI: tsup + schema export
pnpm --filter @agentsync/adapter-sdk run build       # SDK: tsup dual ESM/CJS
cd packages/action && pnpm install && pnpm run build # GitHub Action: ncc bundle
```

Artifacts:

- `dist/cli/index.js` — bin entry (`#!/usr/bin/env node` at top)
- `dist/index.js` — library entry
- `packages/adapter-sdk/dist/*` — published SDK
- `packages/action/dist/index.js` — bundled GH Action (474 KB after ncc minify)
- `docs/schema/v1/*.json` — JSON Schemas (manifest, frontmatter, config, memory-file, repo-map, stack, policy)

## Publish (planned, not yet active)

The plan is to publish two npm packages:

- **`@agentsync/cli`** — main package, ships the `agentsync` binary
- **`@agentsync/adapter-sdk`** — separately versioned, semver-pinned by third-party adapter authors

Until publishing flows are set up, local builds work via the workspace link.

## Release checklist (for when we go to npm)

1. All tests green except the known pre-existing `init.test.ts` determinism issue
2. `agentsync scan --check && agentsync sync --check && agentsync lint` exit 0 against this repo
3. Bump version in `package.json` AND `packages/adapter-sdk/package.json` (these versions are independent)
4. `pnpm pack` in each package; smoke-test the resulting tarballs in a scratch dir
5. `npm publish --access public` for each
6. Tag the git commit with `cli-vX.Y.Z` and `sdk-vX.Y.Z`
7. GitHub release with changelog

## GitHub Action

`packages/action/action.yml` declares a Node 20 composite action. It invokes `npx -y @agentsync/cli sync --check,lint` in the consumer repo and surfaces lint findings as PR annotations via `@actions/core`.

To consume in this very repo, see `.github/workflows/agentsync.yml`.

## Versioning rules

- **CLI** uses caret (`^x.y.z`) ranges in consuming projects' dependencies.
- **SDK** is the public contract for adapter authors. Breaking changes require a major bump.
- **MCP server** spec compatibility: we pin `@modelcontextprotocol/sdk` to track a specific spec version. Changelog calls out spec bumps.
