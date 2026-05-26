# Agent Memory Synchronizer — Feature Plan (TypeScript-first)

## Core Problem

Developers use multiple AI coding agents (Claude Code, Codex, Cursor, Cline, Windsurf, Copilot). Each tool maintains its own memory, repo instructions, project context, architecture summaries, coding conventions, and workflow guidance. Developers repeatedly re-explain the same repository to every agent, and instructions drift apart over time.

## Goal

Create a shared, repo-local memory layer that synchronizes context across AI coding agents. One file edited → every agent updated. Deterministic. Local-first. No AI in the MVP path.

## Non-Negotiable Principles

- **CLI-first, local-first.** No network calls in default commands.
- **Deterministic.** Same input → byte-identical output across runs and OSes.
- **Plugin-extensible.** Adapters, scanners, and linter rules are pluggable from day one.
- **Git-aware.** Provenance, drift, and reconciliation are built around commits.
- **Fast.** Cold run on a 1k-file repo under 2s; warm run under 500ms.
- **TypeScript strict.** No `any` in core; explicit types at every public boundary.

---

# Milestone 1 — Core Memory Engine

**Goal:** Establish `/agent` as the canonical, repo-local source of truth for AI agent context. Make it dead simple to initialize, validate, and inspect.

**Core Features:**
- `agentsync init` — scaffolds `/agent` with starter templates and `manifest.yaml`
- Standardized file set: `architecture.md`, `coding-rules.md`, `stack.md`, `domain-knowledge.md`, `workflows/*.md`, `repo-map.json`, `manifest.yaml`
- `manifest.yaml` declares files, their source type (`authored | generated | hybrid`), priority, and target adapters
- YAML frontmatter on every markdown file: `name`, `description`, `applies_to`, `priority`, `tags`, `source`
- `agentsync validate` — Zod schema validation, broken-link detection, frontmatter check
- `agentsync show <file>` — pretty-print a memory file with parsed frontmatter (picocolors)
- `.agentsyncignore` (gitignore-style) parsed via `globby` ignore rules
- Local config at `.agentsync/config.yaml`

**Implementation Tasks:**
1. TypeScript scaffold: `tsconfig.json` (strict), `package.json`, dual ESM build via `tsup`
2. Zod schemas for `Manifest`, `Frontmatter`, `MemoryFile`, `Config`
3. `commander`-based CLI shell with `agentsync <verb>` structure
4. `fs-extra` + `globby` file discovery; `js-yaml` for YAML I/O
5. Frontmatter parser (split `---` blocks, parse with `js-yaml`, validate with Zod)
6. Starter template assets bundled into the package under `templates/init/`
7. `picocolors` + `log-symbols` for status output; `ora` for any >100ms operation
8. `agentsync version` reads version from `package.json` (single source of truth)

**Dependencies:** Node 20 LTS, TypeScript 5.x, `commander`, `zod`, `js-yaml`, `fs-extra`, `globby`, `picocolors`, `ora`, `log-symbols`

**Out of Scope:** Parsing source code, generating any per-adapter files, syncing, LLM calls

**Release Criteria:**
- `npm install -g agentsync && agentsync init` works on macOS/Linux/Windows
- `agentsync validate` correctly accepts/rejects a curated fixture suite
- JSON Schemas derived from Zod published under `docs/schema/v1/`
- 100% deterministic; zero network calls in any command

---

# Milestone 2 — Multi-Agent Sync Layer

**Goal:** One command, every agent updated. This is the wedge feature.

**Core Features:**
- `agentsync sync` — generates per-tool files from `/agent`
- Built-in adapters (each a self-contained module, plugin-shaped):
  - `claude` → `CLAUDE.md` (+ optional `.claude/` artifacts)
  - `agents-md` → `AGENTS.md` (Codex / OpenAI convention)
  - `cursor` → `.cursorrules` + `.cursor/rules/*.mdc`
  - `cline` → `.clinerules`
  - `windsurf` → `.windsurfrules`
  - `copilot` → `.github/copilot-instructions.md`
- `agentsync diff [<adapter>]` — preview what would change
- `agentsync sync --check` — CI exit code if drift detected
- Per-adapter token-budget rules (deterministic: priority sort, head-N-chars, drop `optional` sections — **never LLM**)
- Provenance header + content checksum on every generated file (idempotent re-sync)
- Manual-edit handling — **conflict surfacing only, no auto-merge.** If checksum of a generated file doesn't match the last-sync record, `agentsync diff` shows the diff and `agentsync sync` refuses to overwrite without `--force`. The developer is expected to manually copy their edits back into `/agent` and re-run `sync`. No interactive back-port, no prose merging — keep this surface small and predictable for M2.
- `agentsync install-hook` — installs Husky or native git pre-commit hook running `sync --check`

**Implementation Tasks:**
1. `Adapter` interface + base class (see TypeScript example below)
2. In-process plugin registry; lazy-load adapters by name
3. Template strategy: typed string-template helpers in core; adapters may opt into Handlebars
4. `RenderContext` carries memory set, priority order, token budget, project info
5. Provenance header injector + parser (HTML-comment block)
6. Three-way drift detector: source SHA, last-generated cache, on-disk file
7. `simple-git` integration for branch, staged state, dirty-tree checks
8. `--json` output for every command (machine-readable for CI)
9. GitHub Action wrapper that calls `agentsync sync --check`

**Dependencies:** M1 + `simple-git`; optional `handlebars` for adapter authors

**Out of Scope:** Repo source parsing, auto-generation of `architecture.md` content, watch mode

**Release Criteria:**
- Round-trip works for all 6 built-in adapters
- `sync --check` runs in <500ms on a 1k-file repo (warm)
- Idempotent: `sync && sync` produces byte-identical files
- Manual-edit detection is reliable across CRLF/LF line endings
- Snapshot tests (vitest + snapshot serializer) cover every adapter

---

# Milestone 3 — Repo Intelligence Engine (Phase 1: Shape Only)

**Goal:** Give AI agents a fast, factual *shape-of-the-repo* snapshot. No AST, no symbols, no inference — just a directory tree, file sizes, and per-language line counts. Ship this in 1–2 days.

**Scope discipline:** Phase 1 is **purely a filesystem walk + a line counter**. If it needs a parser, it's M3.5. If it needs inference, it's M3.5. The wedge here is "how big is this thing and what's in it" — the cheapest, most useful piece of repo intelligence to deliver first.

**Core Features:**
- `agentsync scan` produces:
  - `repo-map.json` — hierarchical JSON tree of the folder structure (built via `globby`), plus a per-file `lineCount` and per-language summary
  - `stack.md` — auto-detected from `package.json`, `tsconfig.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, Dockerfiles, common CI files. Pure file read + JSON/TOML/YAML parse.
- Default ignores: `node_modules`, `.git`, `dist`, `.next`, `build`, `coverage`, `.venv`, `__pycache__`, plus `.gitignore` + `.agentsyncignore`
- Per-language line counts derived from file extension (no AST). Language map is a static table (`.ts` → TypeScript, `.py` → Python, `.go` → Go, …) — extensible via `.agentsync/config.yaml`
- File-role classification by path/extension heuristics: `entry` (`bin/**`, `main.*`), `test` (`**/*.{test,spec}.*`, `tests/**`), `config` (`*.config.*`, `Dockerfile*`, `.github/**`), `doc` (`**/*.md`), `source` (default)
- Top-level summary block: total files, total lines, language histogram sorted by lines desc
- `.agentsync/cache/` — content-hash keyed cache (only re-read files whose SHA changed; line count is cached)
- `agentsync scan --check` — CI exit code if `repo-map.json` would change

**Out of scope for Phase 1 (deferred to M3.5):**
- `web-tree-sitter`, any AST work
- Symbol extraction (exports, functions, classes)
- `dependency-graph.json`
- `architecture.md` drafting
- `entrypoints.md`
- Secret redaction (no AST = no source content lands in artifacts, so the risk is low; revisit when symbol extraction lands)

**Implementation Tasks:**
1. `FileEnumerator` using `globby` with default + user-configured ignore patterns; respects `.gitignore` via `gitignore: true` and `.agentsyncignore` via `ignoreFiles`
2. `TreeBuilder` — folds the flat `globby` result into a hierarchical `{ name, path, type: "dir" | "file", children?, lineCount? }` JSON tree
3. `LineCounter` — reads each file as a stream, counts `\n` (handles trailing-newline edge case); skips binary files via extension allowlist
4. `LanguageMap` — static `Record<extension, languageName>`; user-overridable in config
5. `RoleClassifier` — pure function: `(path) → "entry" | "test" | "config" | "doc" | "source"`
6. `Summary` aggregator — totals by language, file role counts
7. Content-hash cache: `{ path, sha256 } → { lineCount, language }`
8. `repo-map.json` JSON Schema published under `docs/schema/v1/`

**Dependencies:** M2 + `globby` only (no `web-tree-sitter` in Phase 1)

**Release Criteria:**
- `agentsync scan` produces `repo-map.json` + `stack.md` on this repo and 3 reference repos (Next.js, Hono, FastAPI) without error
- Cold scan <2s on a 1k-file repo; warm (cache hit) <300ms
- Byte-identical output on macOS/Linux/Windows for the same input
- Default ignores correctly exclude `node_modules`, `.git`, build artifacts, virtualenvs

---

# Milestone 3.5 — Repo Intelligence Engine (Phase 2: AST, Inference & Languages)

**Goal:** Layer AST-driven intelligence on top of the Phase 1 shape data, once the simpler path is proven and adopted.

**Core Features:**
- `web-tree-sitter` AST extraction, starting with **TypeScript/JavaScript** (TS, TSX, JS, JSX); Python/Go/Rust/Java/Ruby grammars added incrementally
- Per-file symbol extraction: top-level exports, function/class declarations → `repo-map.json` `files[].symbols`
- `agentsync scan` additionally produces:
  - `dependency-graph.json` — module-level import graph (per-file `imports`/`importedBy`)
  - `entrypoints.md` — `bin` scripts, CLI commands, HTTP routes (Express/Fastify/Hono/Next API), exported public symbols
  - `architecture.md` (draft) — generated from module clustering + dependency density. **Marked as a draft. Users review and promote sections to `authored` or `hybrid`.**
- TypeScript Compiler API path for richer type info (re-exports, type-only imports, declaration merging)
- `@babel/parser` fallback for files tree-sitter can't handle
- Secret-redaction pass before any AST-derived content is written (JWT, AWS keys, GitHub tokens, OpenAI/Anthropic keys); applies once symbol extraction lands and source-derived strings can leak
- `agentsync watch` — `chokidar`-driven re-scan on file change (debounced)
- Worker pool via `node:worker_threads` for monorepo parallelism

**Implementation Tasks:**
1. WASM grammar loader (`web-tree-sitter`) with lazy per-language registry
2. TS/JS symbol extractor → normalized `Symbol[]` (Zod)
3. Module-graph builder (custom, lightweight)
4. `EntrypointDetector` — framework signatures per stack (Hono `app.get`, Next.js `app/**/route.ts`, Express `router.use`, etc.)
5. `ArchitectureDrafter` — clustering by directory + import density; outputs a labeled module map and a short prose summary from templates. **Pure function. No LLM.**
6. Additional language visitors with normalized `Symbol` model
7. Secret redactor with documented pattern set
8. Worker-thread pool with deterministic ordering of results
9. `agentsync watch` with debounced re-scan

**Dependencies:** M3 + `web-tree-sitter`, TS/JS WASM grammar (first), then Python/Go/Rust/Java/Ruby + `typescript`, `@babel/parser`, `chokidar`

**Release Criteria:**
- Scans 5 popular OSS repos (Next.js, Hono, tRPC, Astro, FastAPI) without error
- Incremental scan <2s on a 10k-file repo
- `architecture.md` drafts validated against 3 real repos with maintainer review
- Byte-identical output across OSes
- Secret-redaction unit tests cover the documented pattern set

---

# Milestone 4 — Team & Policy Layer

**Goal:** Make `/agent` a first-class team artifact — reviewable, shareable, enforceable across repos.

**Core Features:**
- `agentsync lint` — configurable style rules (heading hierarchy, banned vague phrases, freshness check, required sections)
- `agentsync stats` — token counts per adapter, drift frequency, last-updated metrics, `--json`
- `agentsync export <path>` — bundle `/agent` as a portable tarball
- `agentsync import <url|path>` — pull a starter `/agent` from any git URL or local path
- `agentsync inherit <git-url>` — extend a shared base `/agent` (copy-on-write merge, no submodules)
- Conflict markers when two contributors edit the same memory section
- Official GitHub Action: `agent-memory-synchronizer/action` — runs `sync --check` + `lint` on PRs
- VS Code extension (thin) — preview generated files, jump source ↔ generated, decorate drift in editor gutter
- Pre-commit framework integration + Husky template
- Policy file `agentsync.policy.yaml` — orgs can require specific files, target adapters, lint rules

**Implementation Tasks:**
1. Linter rule engine: YAML-declarative rules → compiled to TS functions
2. Template registry spec — plain list of git URLs in a curated README; no central server
3. GitHub Action published to marketplace (Node 20 runtime)
4. VS Code extension MVP (read-only viewer first, then jump-to-source)
5. Policy resolver + `--policy <path>` flag on `sync`/`lint`/`validate`

**Dependencies:** M3 + GitHub Actions runner, VS Code Extension API, `simple-git`

**Out of Scope:** Hosted SaaS, accounts, billing, team dashboards, real-time collab

**Release Criteria:**
- A team can fork a starter template and customize it in <5 min
- CI catches drift on PRs and posts a clear failure annotation
- ≥3 community-contributed starter templates merged

---

# Milestone 5 — Ecosystem & Optional Intelligence (Post-Adoption)

**Goal:** Once the deterministic core is trusted, expose carefully gated opt-in surfaces.

**Core Features (each behind an explicit flag):**
- `agentsync ai-draft` — opt-in LLM-assisted drafting of `architecture.md` / `domain-knowledge.md` (BYO key)
- MCP server (`agentsync mcp`) — expose `/agent` as a Model Context Protocol resource
- Adapter SDK package (`@agentsync/adapter-sdk`) — published separately so third-party adapters can semver-pin
- Telemetry — explicit opt-in via `agentsync telemetry on`, anonymous counts only

**Out of Scope:** Cloud sync, federation, vector search, hosted dashboards, accounts

**Release Criteria:** Each gated feature ships as a separate `npm` package so the core remains LLM-free and lightweight.

---

# Recommended TypeScript / Node Architecture

```
memory-synchronizer/
├── package.json
├── tsconfig.json                   # strict: true, noUncheckedIndexedAccess
├── tsup.config.ts                  # dual ESM + CJS builds, single .d.ts
├── vitest.config.ts
├── README.md
├── LICENSE                         # MIT
├── docs/
│   ├── schema/v1/                  # JSON Schemas derived from Zod
│   └── adapters/                   # per-adapter docs
├── src/
│   ├── cli/
│   │   ├── index.ts                # commander entry, registers all commands
│   │   ├── init.ts
│   │   ├── sync.ts
│   │   ├── diff.ts
│   │   ├── validate.ts
│   │   ├── show.ts
│   │   ├── scan.ts
│   │   ├── watch.ts
│   │   ├── lint.ts
│   │   ├── stats.ts
│   │   ├── export.ts
│   │   ├── import.ts
│   │   ├── installHook.ts
│   │   └── adapter.ts              # `adapter list|info`
│   ├── core/
│   │   ├── manifest.ts             # Zod models
│   │   ├── frontmatter.ts
│   │   ├── memory.ts               # MemoryFile, MemorySet
│   │   ├── config.ts
│   │   ├── ignore.ts               # .agentsyncignore parser
│   │   ├── provenance.ts           # header injection + parsing
│   │   ├── drift.ts                # 3-way reconciliation
│   │   ├── cache.ts                # content-hash cache
│   │   ├── git.ts                  # simple-git wrappers
│   │   └── logger.ts               # picocolors + log-symbols facade
│   ├── adapters/
│   │   ├── base.ts                 # Adapter interface + helpers
│   │   ├── registry.ts             # plugin discovery
│   │   ├── claude.ts
│   │   ├── agentsMd.ts
│   │   ├── cursor.ts
│   │   ├── cline.ts
│   │   ├── windsurf.ts
│   │   └── copilot.ts
│   ├── scanners/
│   │   ├── base.ts                 # Scanner interface
│   │   ├── enumerator.ts
│   │   ├── treeSitter.ts           # web-tree-sitter loader
│   │   ├── tsCompiler.ts           # TypeScript Compiler API path
│   │   ├── stackDetector.ts
│   │   ├── graphBuilder.ts
│   │   ├── redactor.ts             # secret patterns
│   │   └── languages/
│   │       ├── typescript.ts
│   │       ├── python.ts
│   │       ├── go.ts
│   │       └── ...
│   ├── generators/                 # deterministic markdown emitters
│   │   ├── architecture.ts
│   │   ├── stack.ts
│   │   ├── entrypoints.ts
│   │   └── repoMap.ts
│   ├── linter/
│   │   ├── engine.ts
│   │   └── rules/
│   ├── templates/                  # bundled init + adapter templates
│   │   ├── init/
│   │   └── adapters/
│   ├── schema/                     # JSON Schema export from Zod
│   └── index.ts                    # library export surface
├── tests/
│   ├── fixtures/repos/             # mini repos for integration tests
│   ├── adapters/                   # snapshot tests per adapter
│   └── scanners/
└── packages/
    ├── adapter-sdk/                # public SDK (M5)
    ├── action/                     # GitHub Action (M4)
    └── vscode-extension/           # VS Code thin client (M4)
```

**Module rules:**
- `core/` has no dependency on `cli/`. CLI imports core; core never reaches up.
- `adapters/` depend only on `core/` types and the `Adapter` interface.
- `scanners/` depend only on `core/` and `web-tree-sitter`.
- `generators/` are pure functions of `MemorySet + ScanResult → string`.

---

# Plugin Architecture Design

Plugins are plain ESM packages with a default export implementing a typed interface. Discovery is opt-in via:

1. `package.json` `keywords: ["agentsync-adapter"]` + npm registry search (offline scan of `node_modules`)
2. Explicit registration in `.agentsync/config.yaml`:
   ```yaml
   plugins:
     adapters:
       - "@agentsync/adapter-aider"
       - "./local-adapters/custom-claude.js"
   ```

No global registry, no SaaS. Just npm packages and explicit imports.

### Adapter interface (TypeScript)

```ts
// src/adapters/base.ts
import type { MemorySet } from "../core/memory.js";
import type { RenderContext, GeneratedFile } from "../core/types.js";

export interface Adapter {
  readonly name: string;            // "claude", "cursor", ...
  readonly version: string;         // semver
  readonly outputPaths: string[];   // repo-relative paths the adapter writes

  render(memory: MemorySet, ctx: RenderContext): Promise<GeneratedFile[]>;

  tokenBudget?(): number | null;
  supportsPartial?(): boolean;
  postProcess?(file: GeneratedFile): GeneratedFile;
}

export interface GeneratedFile {
  path: string;
  contents: string;
  checksum: string;        // sha256 of contents after provenance strip
  sourceSha: string;       // checksum of contributing /agent files
}

export interface RenderContext {
  projectName: string;
  manifestVersion: number;
  tokenBudget: number | null;
  priorityOrder: string[];   // file names sorted high → low
  generatorVersion: string;
  now: string;               // ISO timestamp, frozen per run for determinism
}
```

### Scanner interface

```ts
// src/scanners/base.ts
import type { Symbol, FileFact } from "../core/types.js";

export interface Scanner {
  readonly language: string;       // "typescript", "python", ...
  readonly extensions: string[];   // [".ts", ".tsx"]

  parse(file: { path: string; sha: string; source: string }): Promise<{
    symbols: Symbol[];
    imports: string[];
    facts: FileFact[];
  }>;
}
```

### Linter rule interface

```ts
// src/linter/rule.ts
import type { MemoryFile } from "../core/memory.js";

export interface LintRule {
  readonly id: string;             // "no-vague-phrases"
  readonly defaultLevel: "off" | "warn" | "error";
  check(file: MemoryFile): LintFinding[];
}

export interface LintFinding {
  ruleId: string;
  line: number;
  message: string;
  fix?: { range: [number, number]; replacement: string };
}
```

### Plugin shape (community example)

```ts
// agentsync-aider/src/index.ts
import type { Adapter, GeneratedFile, RenderContext } from "@agentsync/adapter-sdk";
import type { MemorySet } from "@agentsync/adapter-sdk";

const AiderAdapter: Adapter = {
  name: "aider",
  version: "0.1.0",
  outputPaths: [".aider.conf.yml"],

  async render(memory: MemorySet, ctx: RenderContext): Promise<GeneratedFile[]> {
    const body = renderAiderConfig(memory, ctx);
    return [
      {
        path: ".aider.conf.yml",
        contents: body,
        checksum: sha256(body),
        sourceSha: ctx.sourceSha,
      },
    ];
  },
};

export default AiderAdapter;
```

---

# Repo Scanning + Memory Generation Strategy

```
┌──────────────────────────────────────────────────────┐
│  agentsync scan                                      │
└──────────────┬───────────────────────────────────────┘
               │
   ┌───────────▼────────────┐
   │  FileEnumerator        │ globby + .gitignore + .agentsyncignore
   └───────────┬────────────┘
               │ (path, lang, sha)
   ┌───────────▼────────────┐    ┌────────────────────┐
   │  CacheLookup           │◄──►│ .agentsync/cache   │ key = (path, sha, parser_version)
   └───────────┬────────────┘    └────────────────────┘
               │ misses
   ┌───────────▼────────────┐
   │  Parser dispatch       │ web-tree-sitter (WASM) | TS Compiler API | @babel/parser
   └───────────┬────────────┘
               │ AST
   ┌───────────▼────────────┐
   │  SymbolExtractor       │ → normalized Symbol[]
   └───────────┬────────────┘
               │
   ┌───────────▼────────────┐
   │  Redactor              │ regex-based secret scrub
   └───────────┬────────────┘
               │
   ┌───────────▼────────────┐    ┌────────────────────┐
   │  GraphBuilder          │───►│ dependency-graph   │
   └───────────┬────────────┘    └────────────────────┘
               │
   ┌───────────▼────────────┐    ┌────────────────────┐
   │  Generators (pure)     │───►│ repo-map.json      │
   │  - stackDetector       │    │ stack.md           │
   │  - entrypointDetector  │    │ entrypoints.md     │
   │  - architectureDrafter │    │ architecture.md    │
   └────────────────────────┘    └────────────────────┘
```

**Key principles:**
- **Scanner emits facts, generators emit prose, humans own opinion files.**
- Every file in `/agent` has `source: authored | generated | hybrid`.
- `hybrid` files have HTML-comment markers (`<!-- agentsync:begin generated -->` / `<!-- agentsync:end -->`) delimiting generated blocks; human prose lives outside.
- Generators are pure functions. Same `(MemorySet, ScanResult, generatorVersion) → string` always.

**Why web-tree-sitter (not native `tree-sitter`):** WASM grammars install cleanly across npm consumers, avoid native build toolchains (no `node-gyp`), and produce identical ASTs on every OS. Slower than native, but well within the <2s incremental budget once cached.

---

# File Formats and Schema Design (Zod)

```ts
// src/core/manifest.ts
import { z } from "zod";

export const SourceType = z.enum(["authored", "generated", "hybrid"]);

export const FrontmatterSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  source: SourceType.default("authored"),
  priority: z.number().int().min(0).max(100).default(50),
  applies_to: z.array(z.string()).default(["*"]),
  tags: z.array(z.string()).default([]),
});
export type Frontmatter = z.infer<typeof FrontmatterSchema>;

export const ManifestFileEntry = z.object({
  path: z.string(),
  source: SourceType,
  priority: z.number().int().default(50),
  applies_to: z.array(z.string()).default(["*"]),
});

export const ManifestSchema = z.object({
  version: z.literal(1),
  project: z.object({
    name: z.string(),
    description: z.string().optional(),
  }),
  targets: z.array(z.string()).min(1),
  files: z.array(ManifestFileEntry),
  generation: z
    .object({
      scanner: z.enum(["web-tree-sitter", "off"]).default("web-tree-sitter"),
      exclude: z.array(z.string()).default([]),
    })
    .default({ scanner: "web-tree-sitter", exclude: [] }),
});
export type Manifest = z.infer<typeof ManifestSchema>;

export const ConfigSchema = z.object({
  defaultAdapters: z.array(z.string()).default(["claude", "agents-md"]),
  tokenBudgets: z.record(z.string(), z.number().int().positive()).default({}),
  plugins: z
    .object({
      adapters: z.array(z.string()).default([]),
      scanners: z.array(z.string()).default([]),
      lintRules: z.array(z.string()).default([]),
    })
    .default({ adapters: [], scanners: [], lintRules: [] }),
});
export type Config = z.infer<typeof ConfigSchema>;
```

### `/agent/manifest.yaml`

```yaml
version: 1
project:
  name: my-app
  description: short one-liner
targets:
  - claude
  - agents-md
  - cursor
files:
  - path: architecture.md
    source: hybrid
    priority: 10
    applies_to: [claude, cursor]
  - path: coding-rules.md
    source: authored
    priority: 20
    applies_to: ["*"]
  - path: repo-map.json
    source: generated
    applies_to: [claude]
generation:
  scanner: web-tree-sitter
  exclude:
    - node_modules
    - dist
    - .next
```

### Memory file frontmatter

```yaml
---
name: coding-rules
description: Project-wide coding conventions
source: authored
priority: 20
applies_to: ["*"]
tags: [conventions, style]
---
```

### Generated-file provenance header

```markdown
<!-- agentsync:generated -->
<!-- source-sha: a1b2c3d4 -->
<!-- generator: claude-adapter@0.3.1 -->
<!-- generated-at: 2026-05-27T00:00:00Z -->
<!-- DO NOT EDIT — run `agentsync sync` instead -->
```

All schemas are exported as JSON Schema (via `zod-to-json-schema`) under `docs/schema/v1/` for editor integrations.

---

# Synchronization Strategy Across AI Tools

**Source of truth:** `/agent/*` (authored + generated facts).
**Targets:** tool-specific files at conventional paths.

### Sync flow

1. Load `manifest.yaml` → resolve active adapters (manifest `targets` ∩ config `defaultAdapters` + CLI flags).
2. Build `MemorySet` from all files in `/agent`, validate frontmatter.
3. If `manifest.generation.scanner !== "off"` and any `generated` file is stale → run `scan` first.
4. For each adapter:
   - Filter files by `applies_to`.
   - Sort by `priority` (low number = higher placement).
   - Apply token-budget rules (head-N-chars, drop sections tagged `optional`, fold workflows into appendix).
   - Render via adapter (typed templates).
   - Inject provenance header.
   - Compute checksum.
   - Compare to on-disk file.
5. Three-way drift check:
   - `A` = current `/agent` source SHA
   - `B` = last-generated checksum in `.agentsync/last-sync.json`
   - `C` = current on-disk file checksum (after provenance strip)
   - `B == C` → safe to write
   - `B != C` → human edited generated file → `sync` refuses to overwrite without `--force` and points the user at `agentsync diff` to inspect their changes; `--check` fails with the diff. **No auto-merge, no interactive back-port.** Developer manually copies their edits back into `/agent` and re-runs `sync`.

### Token budget rules (deterministic, no LLM)

1. Compute approximate token count (chars / 4 heuristic, configurable).
2. Sort sections by `priority`.
3. While over budget: drop sections tagged `optional` (lowest priority first).
4. If still over: truncate `domain-knowledge.md` to head-N chars (configurable per adapter).
5. Emit a footer noting truncation with offsets so users can spot it.

**Never an LLM in the sync path.** Determinism is the brand.

---

# CLI Command Design

```
agentsync init [--template <name>] [--targets claude,cursor,...] [--yes]
agentsync validate [--strict] [--json]
agentsync sync [--check] [--adapter <name>...] [--dry-run] [--force]
agentsync diff [<adapter>] [--json]
agentsync scan [--incremental] [--lang ts,py] [--no-cache]
agentsync watch
agentsync lint [--fix] [--json]
agentsync stats [--json]
agentsync show <file>
agentsync export <path>
agentsync import <url-or-path> [--into agent/]
agentsync install-hook [husky|pre-commit|native]
agentsync adapter list
agentsync adapter info <name>
agentsync version
```

**Design principles:**
- Verbs first, nouns second.
- Every command supports `--json` for scripting.
- `--check` everywhere it makes sense (CI-friendly).
- Exit codes: `0` ok, `1` user error, `2` drift detected, `3` internal error.
- Global flags: `--cwd <path>`, `--quiet`, `--verbose`, `--no-color`.
- All commands are stdin/stdout-clean — logs go to stderr, structured output to stdout.

---

# Memory Schema Examples (Zod)

```ts
// src/core/memory.ts
import { z } from "zod";
import { FrontmatterSchema } from "./manifest.js";

export const MemoryFileSchema = z.object({
  path: z.string(),                     // repo-relative
  frontmatter: FrontmatterSchema,
  body: z.string(),                     // markdown after frontmatter
  sha: z.string().length(64),           // sha256 of full file
});
export type MemoryFile = z.infer<typeof MemoryFileSchema>;

export const MemorySetSchema = z.object({
  manifestVersion: z.literal(1),
  files: z.array(MemoryFileSchema),
  scanArtifacts: z
    .object({
      repoMap: z.unknown().optional(),
      dependencyGraph: z.unknown().optional(),
    })
    .optional(),
});
export type MemorySet = z.infer<typeof MemorySetSchema>;
```

```ts
// src/core/types.ts
import { z } from "zod";

export const SymbolSchema = z.object({
  name: z.string(),
  kind: z.enum(["function", "class", "interface", "type", "const", "module", "route"]),
  file: z.string(),
  line: z.number().int().nonnegative(),
  exported: z.boolean(),
  signature: z.string().optional(),
});
export type Symbol = z.infer<typeof SymbolSchema>;

export const FileFactSchema = z.object({
  path: z.string(),
  role: z.enum(["entry", "test", "config", "source", "doc", "asset"]),
  language: z.string(),
  lineCount: z.number().int().nonnegative(),
});
export type FileFact = z.infer<typeof FileFactSchema>;
```

---

# Suggested 30-Day Roadmap

**Week 1 — Foundation (M1)**
- Day 1–2: TS scaffold, `tsup` dual build, Vitest, CI matrix (Node 20 LTS on mac/linux/win)
- Day 3–4: Zod models + JSON Schema export, frontmatter parser, validator
- Day 5: `agentsync init` with bundled templates
- Day 6–7: `agentsync validate`, `show`, `.agentsyncignore` parser

**Week 2 — Sync Engine (M2)**
- Day 8–9: `Adapter` interface, registry, provenance headers
- Day 10: Claude + AGENTS.md adapters + snapshot tests
- Day 11: Cursor + Cline adapters
- Day 12: Windsurf + Copilot adapters
- Day 13: `sync`, `diff`, `--check`
- Day 14: Drift detection (conflict surfacing, no auto-merge), `install-hook`

**Week 3 — Polish + Distribution**
- Day 15: Token-budget rules, `--json` everywhere
- Day 16: GitHub Action package, README + asciinema
- Day 17: Snapshot tests across all adapters + LF/CRLF normalization
- Day 18: Cross-OS determinism audit; fix Windows path bugs
- Day 19: Docs site (`docusaurus` or `astro starlight`)
- Day 20: LICENSE, security policy, contribution guide
- Day 21: `v0.1.0` to npm + GitHub release

**Week 4 — Scanner Preview (M3 seed)**
- Day 22–23: `web-tree-sitter` loader + TS/JS scanner
- Day 24: Python scanner
- Day 25: `stack.md` auto-detection (`package.json`, `tsconfig.json`, `pyproject.toml`)
- Day 26: `repo-map.json` generator
- Day 27: Content-hash cache
- Day 28: `agentsync scan` behind `--experimental` flag
- Day 29: Launch on HN/Reddit/X
- Day 30: Triage feedback, plan M3 GA

---

# Top 5 GitHub-Star-Worthy Features

1. **One-command sync across 6 agents.** Edit one file → CLAUDE.md, AGENTS.md, .cursorrules, .clinerules, .windsurfrules, copilot-instructions.md all update. The 60-second demo.
2. **CI drift detection.** GitHub Action that blocks PRs with stale agent files. Teams adopt this immediately.
3. **Deterministic repo intelligence.** `agentsync scan` produces byte-identical output every run. No API keys, no flakiness. The trust play.
4. **Plugin ecosystem from day one.** `npm install agentsync-zed` and it just works. Community-built adapters compound stars.
5. **Starter template gallery.** Curated `/agent` templates for Next.js, Hono, Astro, Express, monorepos. Each template = SEO + a contributor on-ramp.

---

# Risks and Failure Modes

1. **Adapter-format churn.** Cursor/Cline/Windsurf change conventions frequently. Mitigation: adapters as plugins, semver pinning, integration tests against real tool fixtures, fast-follow releases.
2. **Convention collisions.** `CLAUDE.md` and `AGENTS.md` may overlap; users may want both. Solved via explicit `applies_to` in manifest + per-adapter filtering.
3. **Manual-edit footgun.** Devs will edit generated files. Provenance header + clear conflict messaging from `agentsync diff` must land in M2; the explicit "no auto-merge, copy your changes back manually" policy keeps the failure mode obvious instead of clever. Revisit a `pull`-style back-port only after real user feedback.
4. **WASM grammar size.** Tree-sitter WASM bundles can be 1–5MB each. Mitigation: lazy-load grammars on first parse per language; never bundle eagerly.
5. **Cross-OS determinism.** Line endings (CRLF/LF), path separators, file ordering, locale-sensitive sort all break byte-identical output. Mitigation: normalize at every I/O boundary; CI matrix from day one.
6. **Token-budget vs completeness.** Naive truncation hurts. Be explicit: deterministic rules in v1; LLM-assisted summarization is M5+ opt-in.
7. **Secret leakage.** Scanner may pick up hardcoded API keys in source. Mitigation: regex-based redactor before any artifact is written; documented pattern set.
8. **Monorepo performance.** Single Node process scanning 100k files is slow. Mitigation: `worker_threads` pool in M3; cache-by-default.
9. **Naming / branding.** "Agent Memory Synchronizer" is descriptive but long. CLI = `agentsync`; npm package may be `agentsync` or `@agentsync/cli` (TBD based on availability).
10. **Vendor relations.** If Anthropic/OpenAI shift CLAUDE.md/AGENTS.md spec, you need fast adapter updates. Stay close to public docs; pin examples in CI fixtures.
11. **`commander` vs `oclif` lock-in.** Start with `commander` (simpler), migrate to `oclif` only if plugin auto-discovery becomes the bottleneck. Don't pre-optimize.
12. **`web-tree-sitter` worker setup.** Browser-style WASM init can be fiddly under Node. Mitigation: bundled init helper + smoke tests on all 3 OSes.

---

# What NOT to Build Early

- ❌ Vector databases, embeddings, RAG
- ❌ LLM-powered content generation in the default path
- ❌ Hosted dashboard, accounts, billing, SaaS backend
- ❌ Distributed sync server / cross-repo federation
- ❌ MCP server (revisit after M3 ships and proves the deterministic core)
- ❌ "Universal agent protocol" — let the market converge first
- ❌ Encrypted memory / secrets manager
- ❌ Browser extension
- ❌ Native IDE plugins beyond a thin VS Code preview
- ❌ Telemetry collection (even anonymous) until users opt in via `agentsync telemetry on`
- ❌ `oclif` migration before plugin demand is real
- ❌ Authentication / user model
- ❌ Microservices anything
- ❌ Real-time collab / CRDTs

---

# Open-Source Growth Strategy

1. **Land with a viral 60-second demo.** Asciinema: `agentsync init` → edit `architecture.md` → `agentsync sync` → all six target files appear. Lead the README with it.
2. **Ship M1+M2 before any tweet.** Half-built tools die. Sync across ≥4 agents on day one.
3. **Position as "Prettier for AI memory."** Single config, multiple outputs, deterministic. Avoid AI-hype framing.
4. **Starter templates as flywheel.** `agentsync-templates` repo: Next.js, Hono, Astro, Express, NestJS, Django, FastAPI, Rails, Go services, Turborepo monorepos. Each template = a blog post = SEO + adoption.
5. **GitHub Action in the marketplace by M2.** Discoverability lever; teams find it via Action search before they find the CLI.
6. **`pre-commit` and Husky integrations** in the official hook indexes by M2.
7. **Adapter plugin program.** Document `@agentsync/adapter-sdk`. Curate `agentsync-adapters` README listing community adapters. Make publishing a 10-minute task.
8. **Conference / blog content.** "Why we standardize agent memory" — technical, opinionated, non-promotional. Aim at thoughtbot/Vercel/Cloudflare engineering blogs.
9. **Don't sell, document.** Comprehensive spec docs (`docs/schema/v1/`) win developer trust.
10. **Engage upstream.** Open PRs into Cursor/Cline/Windsurf docs showing how to integrate. Stay friendly with vendors.

---

# Future Monetization Paths

(All optional, none required for OSS success. Pursue only after >5k stars and clear demand.)

1. **Hosted template registry & analytics.** Pro tier for orgs: private templates, drift dashboards, audit logs.
2. **Team policy server.** Self-hostable backend enforcing `agentsync.policy.yaml` across many repos.
3. **AI-assisted authoring (opt-in).** Paid tier where LLM drafts `architecture.md` / `domain-knowledge.md` from scanner output. Keep OSS core LLM-free.
4. **Enterprise compliance pack.** SSO, audit log, policy enforcement, SOC2.
5. **Managed GitHub App.** Auto-PRs to keep agent files synced across an org's repos. Per-repo or per-seat pricing.
6. **Adapter marketplace revenue share.** If vendors want certified adapters with SLAs.
7. **Training / consulting.** Workshops on "AI-ready repos" — classic dev-tools monetization.
8. **GitHub Sponsors** as bridge revenue.

Order of seriousness: **1 → 5 → 2**. Avoid 3 until the LLM-free brand is rock-solid — switching too early dilutes positioning.

---

# Example Folder Structures

**Starter `/agent` after `agentsync init`:**
```
agent/
├── manifest.yaml
├── architecture.md         # hybrid
├── coding-rules.md         # authored
├── stack.md                # generated
├── domain-knowledge.md     # authored
├── repo-map.json           # generated
└── workflows/
    ├── testing.md
    ├── deployment.md
    └── debugging.md
```

**After sync on a Next.js repo:**
```
.
├── agent/...
├── CLAUDE.md                          # generated
├── AGENTS.md                          # generated
├── .cursorrules                       # generated
├── .cursor/rules/*.mdc                # generated
├── .clinerules                        # generated
├── .windsurfrules                     # generated
└── .github/copilot-instructions.md    # generated
```

**Repo-local config + cache:**
```
.agentsync/
├── config.yaml
├── cache/
│   ├── parsers/<sha>.json
│   └── scan-results.json
└── last-sync.json
```

---

**Bottom line:** ship M1 + M2 in 21 days. The viral wedge is **"one file, every agent, deterministic"** — protect that simplicity ruthlessly. Scanners and team policy are the moat that lands after adoption, not before.
