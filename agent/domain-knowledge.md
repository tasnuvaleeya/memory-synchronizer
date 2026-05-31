---
name: domain-knowledge
description: Business and domain context for agentctx.
source: authored
priority: 40
applies_to: ["*"]
tags: [domain, context]
---

# Domain knowledge

## The problem

Developers use multiple AI coding agents — Claude Code, Codex, Cursor, Cline, Windsurf, Copilot. Each tool maintains its own memory file format (`CLAUDE.md`, `AGENTS.md`, `.cursorrules`, etc.). Today, devs re-explain the same repo to each tool, and the various memory files drift apart.

`agentctx` is the shared, repo-local memory layer that fixes this. One edit in `agent/` → every supported tool's context file is regenerated.

## Positioning

**"Prettier for AI memory."** Single config, multiple outputs, deterministic. Avoid AI-hype framing. The deterministic, local-first, LLM-free brand is the moat — straying from it dilutes the product's identity.

## Key concepts

- **`agent/`** — The single source of truth. Markdown files with YAML frontmatter, plus `manifest.yaml`. Lives in every consuming repo. Reviewable in code review.
- **`manifest.yaml`** — Declares which files exist, their `source` type (`authored` / `generated` / `hybrid`), their `priority` (low number = higher placement in token budget), and which adapters they apply to.
- **Adapters** — Per-tool emitters. Read the `MemorySet`, produce zero or more `GeneratedFile`s at conventional paths.
- **`source: authored`** — Human-written. `agentctx sync` never touches these.
- **`source: generated`** — Machine-emitted (e.g., `stack.md`, `repo-map.json`). `agentctx scan` overwrites them.
- **`source: hybrid`** — Mixed. HTML-comment markers delimit generated blocks; human prose lives outside.
- **Drift** — When a user manually edits a generated file (`CLAUDE.md`, etc.) instead of the source in `agent/`. We detect via three-way checksum (source SHA, last-sync record, on-disk file). `agentctx sync` refuses to overwrite drifted files without `--force`; user manually copies their edits back.
- **Provenance header** — HTML comments at the top of every generated file declaring `source-sha`, `generator`, `generated-at`, and a "DO NOT EDIT" note. Stripped before checksumming.

## Non-negotiable principles

1. **CLI-first, local-first.** No network calls in default commands. Ever.
2. **Deterministic.** Byte-identical output for the same input across runs and OSes.
3. **Plugin-extensible.** Adapters, scanners, linter rules are pluggable. `@agentctx/adapter-sdk` is the public contract.
4. **Git-aware.** Provenance, drift, reconciliation all sit on top of git commits.
5. **Fast.** Cold run on a 1k-file repo under 2s; warm under 500ms.

## What `agentctx` is NOT

- Not an LLM wrapper. The default install never calls an LLM. (`agentctx ai-draft` will land in M5.5 as a separately installed package.)
- Not a SaaS. There is no hosted backend.
- Not a federation server, vector DB, or RAG system.
- Not a "universal agent protocol." We adapt to existing tool conventions rather than inventing a new one.

## Audience

- **Primary:** mid-to-senior engineers on teams using ≥2 AI coding tools.
- **Secondary:** OSS maintainers who want their starter templates to "just work" across AI tools.
- **Tertiary:** vendors of new AI coding tools who want a quick integration path (write a 50-line adapter, become a target).
