---
name: architecture
description: High-level architecture and module boundaries for agentsync.
source: hybrid
priority: 10
applies_to: ["*"]
tags: [architecture, overview]
---

# Architecture

## System overview

`agentsync` is a CLI tool that maintains a single source-of-truth memory layer (the `agent/` directory) and synchronizes it to per-tool context files (`CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `.clinerules`, `.windsurfrules`, `.github/copilot-instructions.md`). The product positions itself as "Prettier for AI memory" — deterministic, local-first, LLM-free in the default path. Users edit one file in `agent/`; every supported AI agent gets the same context after one `agentsync sync`.

## Modules

- `src/cli/` — Command handlers. One file per verb (`init`, `validate`, `show`, `version`, `sync`, `diff`, `installHook`, `scan`, `lint`, `stats`, `export`, `import`, `mcp`). `index.ts` is the commander entry point. Handlers never touch the filesystem directly without going through `src/core/paths.ts`.
- `src/core/` — Filesystem, schemas (Zod), config, drift detection, logger, errors, git wrappers. Public boundary types (`MemoryFile`, `MemorySet`, `Frontmatter`, `RenderContext`, `Adapter`) are *re-exported* from `@agentsync/adapter-sdk` so the SDK is the canonical home.
- `src/adapters/` — Six built-in adapters (`claude`, `agents-md`, `cursor`, `cline`, `windsurf`, `copilot`) plus a lazy registry. Each adapter is a pure function of `(MemorySet, RenderContext) → GeneratedFile[]`.
- `src/scanners/` — Filesystem walk + stack detection for `agentsync scan` (M3 Phase 1). No AST; deliberately shape-only.
- `src/generators/` — Pure markdown/JSON renderers (`stack.md`, `repo-map.json`).
- `src/linter/` — Rule engine + 5 built-in rules (`heading-hierarchy`, `banned-vague-phrases`, `required-sections`, `freshness`, `max-length`).
- `src/mcp/` — Read-only MCP server (`agentsync mcp`) exposing `agent/` as Model Context Protocol resources.
- `packages/adapter-sdk/` — Separately versioned npm package. Canonical home for adapter author types and helpers (`applyTokenBudget`, `computeSourceSha`, provenance helpers).
- `packages/action/` — GitHub Action wrapper (Node 20, bundled with `@vercel/ncc`).

## Module rules

- `core/` has no dependency on `cli/`. CLI imports core; core never reaches up.
- `adapters/` depend only on `@agentsync/adapter-sdk` types — never on CLI internals.
- `scanners/` depend only on `core/` and the filesystem.
- `generators/` are pure functions: `(MemorySet, ScanResult) → string`.
- Determinism: every I/O write goes through `writeFileLF` (LF-terminated, parent-dir-created, normalized).

## Entry points

- CLI: `agentsync <verb>` — see `src/cli/index.ts` for the full registry.
- Library: `dist/index.js` re-exports the public types. Adapter authors should use `@agentsync/adapter-sdk` directly.
- MCP: `agentsync mcp` (stdio transport) exposes `agentsync://manifest`, `agentsync://memory/<path>`, `agentsync://adapters/<name>`, `agentsync://scan/*`.

## Dependencies

Runtime: `commander`, `zod`, `js-yaml`, `globby`, `fs-extra`, `picocolors`, `ora`, `log-symbols`, `simple-git`, `tar`, `@modelcontextprotocol/sdk`, `@agentsync/adapter-sdk` (workspace). No network calls in any default command — fully local-first.

## Determinism contract

Same input → byte-identical output across runs and OSes. Mechanisms:
- `compareStrings` for locale-independent sort
- `writeFileLF` normalizes CRLF → LF at every write
- `RenderContext.now` is frozen per run, never mid-run
- `repo-map.json` excludes timestamps; `stack.md` uses a stripped-on-compare provenance line
- Per-adapter outputs are checksummed; CI's `agentsync sync --check` blocks PRs that drift
