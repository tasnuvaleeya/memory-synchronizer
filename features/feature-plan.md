# Agent Memory Synchronizer — Feature Plan

## Core Problem

Developers use multiple AI coding agents (Claude Code, Codex, Cursor, Cline, Windsurf, Copilot). Every tool has separate memory, repo instructions, project context, coding conventions, architecture summaries, and workflow guidance. Developers repeatedly re-explain the same repository to every agent.

## Goal

Create a shared, repo-local memory layer that synchronizes context across AI coding tools.

---

# Milestone 1 — Core Memory Layer

**Goal:** Establish `/agent` as the canonical, repo-local source of truth for AI agent context. Make it dead simple to initialize, edit, and version.

**Features:**
- `agentsync init` — scaffolds `/agent` directory with starter templates
- Standardized file schema: `architecture.md`, `coding-rules.md`, `stack.md`, `domain-knowledge.md`, `workflows/*.md`, `repo-map.json`, `manifest.yaml`
- `manifest.yaml` declares which files exist, their purpose, and target agents (e.g., `targets: [claude, cursor, codex]`)
- `agentsync validate` — schema validation, broken-link detection, frontmatter check
- `agentsync show <file>` — pretty-prints a memory file with frontmatter metadata
- YAML frontmatter on every markdown file: `name`, `description`, `applies_to`, `priority`, `tags`

**Implementation Tasks:**
1. Define JSON Schema for `manifest.yaml` and frontmatter
2. CLI skeleton with `click` or `typer`
3. Template files (opinionated but minimal)
4. Validator using `pydantic` + `jsonschema`
5. `.agentsyncignore` parser (gitignore-style)
6. Local config: `.agentsync/config.yaml` (user prefs, agent targets)

**Dependencies:** Python 3.10+, `typer`, `pydantic`, `pyyaml`, `rich`, `jsonschema`

**Out of Scope:** Parsing source code, generating content, syncing to other agents, any LLM calls

**Release Criteria:**
- `pip install agentsync && agentsync init` works on macOS/Linux/Windows
- Can validate a hand-written `/agent` folder
- Documented schema published on GitHub
- 100% deterministic — no network calls

---

# Milestone 2 — Multi-Agent Sync

**Goal:** One-command synchronization from `/agent` → all major AI tool formats. This is the killer feature that drives initial adoption.

**Features:**
- `agentsync sync` — generates per-tool files from `/agent`
- Built-in adapters (each as a plugin):
  - `claude` → `CLAUDE.md` (+ `.claude/` if present)
  - `agents-md` → `AGENTS.md` (Codex/OpenAI convention)
  - `cursor` → `.cursorrules` + `.cursor/rules/*.mdc`
  - `cline` → `.clinerules`
  - `windsurf` → `.windsurfrules`
  - `copilot` → `.github/copilot-instructions.md`
- `agentsync diff` — shows what would change before sync
- `agentsync sync --check` — CI-friendly exit code if drift detected
- Per-adapter token budget awareness (truncate/summarize with deterministic rules — head/tail/by-priority, NOT LLM)
- Generated-file markers + checksum header so re-syncs are idempotent and detect manual edits
- `agentsync pull` — detect manual edits to generated files and offer to back-port into `/agent` (interactive prompts)

**Implementation Tasks:**
1. Adapter base class + plugin discovery via Python entry points
2. Template engine (Jinja2) per adapter
3. Priority/section ordering logic
4. Checksum + provenance header injection
5. Drift detection (3-way: source, generated, on-disk)
6. Git pre-commit hook installer: `agentsync install-hook`

**Dependencies:** M1 + `jinja2`, `gitpython` (optional)

**Out of Scope:** Parsing repo source, auto-generating content, vector search

**Release Criteria:**
- Round-trip works for all 6 adapters
- `agentsync sync --check` runs in <500ms on a 1000-file repo
- Plugin can be installed via `pip install agentsync-<tool>` and auto-registered
- Idempotent: running sync twice produces zero diff

---

# Milestone 3 — Automated Repo Intelligence

**Goal:** Stop making developers hand-write `architecture.md`. Generate factual, deterministic repo intelligence from the code itself.

**Features:**
- `agentsync scan` — produces:
  - `repo-map.json` — directory tree, file roles (entry/test/config), line counts, language stats
  - `dependency-graph.json` — import graph per language (Python, JS/TS, Go, Rust to start)
  - `stack.md` — auto-detected from `pyproject.toml`, `package.json`, `Cargo.toml`, `go.mod`, `requirements.txt`, Dockerfiles, CI files
  - `entrypoints.md` — `main`, CLI commands, HTTP routes (FastAPI/Flask/Express), exported symbols
  - `architecture.md` (draft) — generated from module clustering + dependency density (deterministic, NO LLM)
- Tree-sitter–based AST extraction for: Python, TS/JS, Go, Rust, Java, Ruby
- `.agentsync/cache/` — incremental, content-hashed cache (only re-parse changed files)
- `agentsync watch` — re-scans on file changes (uses `watchdog`)
- "Generated vs. authored" distinction in manifest — humans own the prose, scanner owns the facts

**Implementation Tasks:**
1. Tree-sitter language packs bundled or lazy-installed
2. AST visitors per language → normalized `Symbol` model (pydantic)
3. Module-graph builder with NetworkX
4. Heuristic-based section generators (no LLM)
5. Cache layer keyed on file SHA + parser version
6. JSON Schema for `repo-map.json` published as a spec

**Dependencies:** M2 + `tree-sitter`, `tree-sitter-languages`, `networkx`, `watchdog`

**Out of Scope:** Semantic summarization, embeddings, RAG, LLM-based content gen (gate behind opt-in flag in M5)

**Release Criteria:**
- Scans this repo + 5 popular OSS repos (FastAPI, Next.js, Ruff, etc.) without error
- Incremental scan <2s on 10k-file repo
- All generated files re-runnable with byte-identical output (deterministic)

---

# Milestone 4 — Team Collaboration Layer

**Goal:** Make `/agent` a first-class team artifact — versioned, reviewable, shareable across repos.

**Features:**
- `agentsync lint` — style/consistency rules for memory files (heading hierarchy, banned vague phrases, freshness check)
- `agentsync stats` — token counts per adapter, drift frequency, last-updated metrics
- `agentsync export` — bundle `/agent` as a portable tarball
- `agentsync import <url|path>` — pull a `/agent` template from another repo or a starter repo
- `agentsync inherit` — extend a shared base `/agent` from another git repo (submodule-free, copy-on-write merge)
- Conflict markers when two contributors edit the same memory section
- GitHub Action: `agentsync-action` — runs `sync --check` + `lint` on PRs
- VS Code extension (thin): preview generated files, jump from `/agent` source to generated target
- Pre-commit framework integration (official hook)

**Implementation Tasks:**
1. Linter rule engine (configurable, YAML-defined rules)
2. Template registry spec (just a list of git URLs — no central server)
3. GitHub Action published in marketplace
4. VS Code extension MVP (read-only viewer first)
5. Pre-commit hook published to `pre-commit-hooks` index

**Dependencies:** M3 + GitHub Actions runner, Node for VS Code extension

**Out of Scope:** Hosted SaaS, accounts, billing, team dashboards

**Release Criteria:**
- A team can fork a starter `/agent` template and customize it in <5 min
- CI catches drift on PRs
- ≥3 community-contributed starter templates merged

---

# Recommended Repository Architecture

```
memory-synchronizer/
├── pyproject.toml
├── README.md
├── LICENSE                 # MIT or Apache-2.0
├── docs/
│   ├── schema/             # JSON Schema specs (versioned)
│   └── adapters/           # per-adapter docs
├── src/agentsync/
│   ├── __init__.py
│   ├── cli/                # typer commands
│   │   ├── init.py
│   │   ├── sync.py
│   │   ├── scan.py
│   │   ├── validate.py
│   │   └── diff.py
│   ├── core/
│   │   ├── manifest.py     # pydantic models
│   │   ├── memory.py       # MemoryFile, MemorySet
│   │   ├── frontmatter.py
│   │   └── cache.py
│   ├── adapters/           # built-in adapters
│   │   ├── base.py         # Adapter ABC
│   │   ├── claude.py
│   │   ├── agents_md.py
│   │   ├── cursor.py
│   │   ├── cline.py
│   │   ├── windsurf.py
│   │   └── copilot.py
│   ├── scanners/
│   │   ├── base.py
│   │   ├── tree_sitter_scanner.py
│   │   ├── stack_detector.py
│   │   ├── graph_builder.py
│   │   └── languages/
│   │       ├── python.py
│   │       ├── typescript.py
│   │       └── ...
│   ├── generators/         # deterministic markdown emitters
│   ├── linter/
│   ├── templates/          # Jinja2 templates per adapter
│   └── plugins.py          # entry-point loading
├── tests/
│   ├── fixtures/repos/     # mini repos for integration tests
│   └── adapters/
└── packages/
    └── vscode-extension/   # M4
```

---

# Technical Stack Recommendations

| Layer | Choice | Why |
|---|---|---|
| Language | Python 3.10+ | Matches user constraint, broad AI-dev overlap |
| CLI | `typer` | Type-driven, autocomplete, mature |
| Validation | `pydantic v2` | Schema + serialization in one |
| Templates | `jinja2` | Deterministic, well-known |
| AST | `tree-sitter` + `tree-sitter-languages` | Multi-language, fast, no LSP runtime |
| Graphs | `networkx` | Pure Python, no native deps |
| Filewatch | `watchdog` | Cross-platform |
| Output | `rich` | Diffs, tables, progress |
| Packaging | `uv` or `hatch` | Modern, fast |
| Testing | `pytest` + `syrupy` (snapshot) | Snapshot tests catch generator drift |
| Lint/Format | `ruff` | Single tool |
| Distribution | PyPI + Homebrew formula + `pipx` instructions | Easy install |

---

# Suggested Parser/Indexing Architecture

```
┌──────────────────────────────────────────────────┐
│  agentsync scan                                  │
└─────────────┬────────────────────────────────────┘
              │
   ┌──────────▼──────────┐
   │  FileEnumerator     │  .agentsyncignore + .gitignore aware
   └──────────┬──────────┘
              │ (path, lang)
   ┌──────────▼──────────┐    ┌──────────────────┐
   │  CacheLookup        │◄──►│ .agentsync/cache │  keyed on (path, sha, parser_version)
   └──────────┬──────────┘    └──────────────────┘
              │ misses
   ┌──────────▼──────────┐
   │  TreeSitterParser   │  per-language grammars
   └──────────┬──────────┘
              │ AST
   ┌──────────▼──────────┐
   │  SymbolExtractor    │  → normalized Symbol[]
   └──────────┬──────────┘
              │
   ┌──────────▼──────────┐    ┌──────────────────┐
   │  GraphBuilder       │───►│ dependency-graph │
   └──────────┬──────────┘    └──────────────────┘
              │
   ┌──────────▼──────────┐    ┌──────────────────┐
   │  DocGenerators      │───►│ repo-map.json    │
   │  (deterministic)    │    │ stack.md         │
   └─────────────────────┘    │ entrypoints.md   │
                              │ architecture.md  │
                              └──────────────────┘
```

Key principle: **scanner emits facts, generators emit prose, humans own opinion files.** Each file in `/agent` has `source: authored | generated | hybrid` in frontmatter. `hybrid` files have HTML-comment markers delimiting generated blocks.

---

# Synchronization Strategy Across AI Tools

**Source of truth:** `/agent/*` (authored + generated facts).
**Targets:** tool-specific files at conventional paths.

Sync flow:
1. Load manifest → determine active adapters.
2. For each adapter:
   - Collect relevant memory files (filter by `applies_to`).
   - Render via Jinja2 template.
   - Inject provenance header: `<!-- agentsync v0.X | source-sha: abc123 | do not edit by hand -->`.
   - Compute checksum, compare to on-disk version.
   - Write if changed.
3. If on-disk checksum doesn't match expected (meaning human edited the generated file):
   - In `sync` mode: surface conflict, require `--force` or `agentsync pull` to reconcile.
   - In `--check` mode: fail with diff.

Three-way reconciliation model:
- `A` = `/agent` source
- `B` = last-generated cached output
- `C` = current on-disk file
- If `B == C`: safe to regenerate.
- If `B != C`: human edited generated file → prompt to back-port.

Token-budget handling per adapter is rule-based (priority sort, head-N-chars, drop sections tagged `optional`) — **no LLM in the sync path**.

---

# File Format Standards

`/agent/manifest.yaml`:
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
  scanner: tree-sitter
  exclude:
    - node_modules
    - dist
```

Memory file frontmatter:
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

Generated-file header:
```markdown
<!-- agentsync:generated -->
<!-- source-sha: a1b2c3d4 -->
<!-- generator: claude-adapter@0.3.1 -->
<!-- DO NOT EDIT — run `agentsync sync` instead -->
```

All schemas versioned under `docs/schema/v1/` and published as JSON Schema for tooling.

---

# Risks and Implementation Challenges

1. **Adapter-format churn.** Cursor, Cline, Windsurf change conventions frequently. Mitigation: adapters as plugins, semver pinning, integration tests against real tool fixtures.
2. **Convention collisions.** `CLAUDE.md` and `AGENTS.md` may overlap; users may want both. Solve via explicit `applies_to` in manifest.
3. **"Manual edit" footgun.** Devs will edit generated files. Provenance header + `pull` command is critical to land in M2.
4. **Tree-sitter native dependencies.** Wheel availability varies. Pin `tree-sitter-languages` carefully, document fallback.
5. **Token budget vs. completeness.** Naive truncation hurts. Be explicit: deterministic rules in v1; LLM-assisted summarization is M5+ opt-in.
6. **Determinism on multi-OS.** File-ordering, line endings, path separators must be normalized. Add CI matrix early.
7. **Privacy / leakage.** Scanner may pick up secrets in code. Mitigation: redact patterns (JWTs, API keys) before writing `repo-map.json`.
8. **Performance on monorepos.** Single Python process scanning 100k files is slow. Plan for parallelism (M3) via `multiprocessing`.
9. **Naming / branding.** "Agent Memory Synchronizer" is descriptive but long. Consider shorter CLI name (`agentsync`, `amsync`) — package may differ from CLI.
10. **Vendor relations.** If Anthropic/OpenAI change CLAUDE.md/AGENTS.md spec, you need fast adapter updates. Stay close to public conventions.

---

# What Should Explicitly NOT Be Built Yet

- ❌ Vector DB / embeddings / RAG
- ❌ LLM-powered content generation in the default path
- ❌ Hosted dashboard, accounts, billing
- ❌ Real-time multiplayer editing
- ❌ MCP server (tempting but premature — revisit after M3)
- ❌ "Universal agent protocol" — let the market converge first
- ❌ Cross-repo memory federation
- ❌ Encrypted memory / secrets manager
- ❌ Browser extension
- ❌ Native IDE plugins beyond a thin VS Code preview
- ❌ Telemetry collection (even anonymous) until users explicitly opt in via `agentsync telemetry on`

---

# Open-Source Growth Strategy

1. **Land with a viral 60-second demo.** Asciinema of: `agentsync init` → edit `architecture.md` → `agentsync sync` → CLAUDE.md, AGENTS.md, .cursorrules all appear. README leads with this.
2. **Ship M1+M2 before any tweet.** Half-built tools die. Sync across ≥4 agents on day one.
3. **Position as "Prettier for AI memory."** Single config, multiple outputs, deterministic. Avoid AI-hype framing.
4. **Starter templates as flywheel.** A `agentsync-templates` repo with templates for FastAPI, Next.js, Django, Rails, Go services, monorepos. Each template = a blog post = SEO + adoption.
5. **GitHub Action in marketplace** by M2 — discoverability lever.
6. **pre-commit hook** in the official index by M2.
7. **Adapter plugin program.** Make it trivial to publish `agentsync-<tool>`. Maintain a registry README listing community adapters.
8. **Conference / blog content.** "Why we standardize agent memory" — technical, opinionated, non-promotional.
9. **Don't sell, document.** Comprehensive spec docs win developer trust.
10. **Engage upstream.** PR examples into Cursor/Cline docs showing them how to integrate.

---

# Recommended 30-Day Implementation Roadmap

**Week 1 — Foundation**
- Day 1–2: Repo scaffold, `pyproject.toml`, CI, schemas
- Day 3–4: `manifest.yaml` model, frontmatter parser, validator
- Day 5: `agentsync init` with starter templates
- Day 6–7: `agentsync validate`, `show`, `.agentsyncignore`

**Week 2 — Sync Engine**
- Day 8–9: Adapter base class, plugin loader, Jinja templates
- Day 10: Claude + AGENTS.md adapters
- Day 11: Cursor + Cline adapters
- Day 12: Windsurf + Copilot adapters
- Day 13: `agentsync sync`, `diff`, `--check`
- Day 14: Provenance headers + drift detection

**Week 3 — Polish + Distribution**
- Day 15–16: Pre-commit hook, GitHub Action
- Day 17: Snapshot tests across all adapters
- Day 18: Windows/macOS/Linux CI matrix
- Day 19: Docs site (mkdocs-material)
- Day 20: Asciinema demo, README, LICENSE
- Day 21: `v0.1.0` release to PyPI

**Week 4 — Scanner Preview**
- Day 22–24: Tree-sitter integration, Python + TS parsers
- Day 25: `stack.md` auto-detection
- Day 26: `repo-map.json` generator
- Day 27: Caching layer
- Day 28: `agentsync scan` behind `--experimental` flag
- Day 29: Launch on HN/Reddit/X
- Day 30: Respond to feedback, triage, plan M3

---

# Suggested CLI Design

```
agentsync init [--template <name>] [--targets claude,cursor,...]
agentsync validate [--strict]
agentsync sync [--check] [--adapter <name>] [--dry-run]
agentsync diff [<adapter>]
agentsync pull [--interactive]
agentsync scan [--incremental] [--lang python,ts]
agentsync watch
agentsync lint
agentsync stats
agentsync show <file>
agentsync export <path>
agentsync import <url-or-path>
agentsync install-hook [pre-commit|husky]
agentsync adapter list
agentsync adapter info <name>
agentsync version
```

Design principles:
- Verbs first, nouns second.
- Every command has `--json` output for scripting.
- `--check` everywhere it makes sense — CI-friendly.
- Exit codes: 0 ok, 1 user error, 2 drift detected, 3 internal error.

---

# Proposed Plugin Architecture

Plugins discovered via Python entry points:

```toml
# In agentsync-cursor's pyproject.toml
[project.entry-points."agentsync.adapters"]
cursor = "agentsync_cursor:CursorAdapter"
```

Adapter ABC:
```python
class Adapter(ABC):
    name: str
    version: str
    output_paths: list[Path]

    @abstractmethod
    def render(self, memory_set: MemorySet, ctx: RenderContext) -> list[GeneratedFile]: ...

    def token_budget(self) -> int | None: return None
    def supports_partial(self) -> bool: return False
    def post_process(self, file: GeneratedFile) -> GeneratedFile: return file
```

Scanner plugins follow the same pattern under `agentsync.scanners`. Linter rules under `agentsync.lint_rules`. This means a community can ship `agentsync-aider`, `agentsync-zed`, etc., without touching core.

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

**After sync on a Python repo:**
```
.
├── agent/...
├── CLAUDE.md               # generated
├── AGENTS.md               # generated
├── .cursorrules            # generated
├── .cursor/rules/*.mdc     # generated
├── .clinerules             # generated
├── .windsurfrules          # generated
└── .github/copilot-instructions.md  # generated
```

**Repo-local config:**
```
.agentsync/
├── config.yaml
├── cache/
│   └── <sha>.json
└── last-sync.json
```

---

# Top 5 GitHub-Star-Worthy Features

1. **One-command sync across 6 agents.** The headline feature. Demo: edit one file, see CLAUDE.md, AGENTS.md, .cursorrules update.
2. **CI drift detection.** GitHub Action that blocks PRs with stale agent files. Teams notice this immediately.
3. **Deterministic repo intelligence.** No LLM, no API keys, no flakiness — `agentsync scan` produces the same output every run. Trust-building.
4. **Plugin ecosystem.** `pip install agentsync-zed` and it just works. Community contributions = stars.
5. **Starter template gallery.** Curated templates for FastAPI, Next.js, Django, monorepos — copy-paste-good agent context in seconds.

---

# Potential Future Monetization Paths

(All optional, none required for OSS success — pursue only after >5k stars and clear demand.)

1. **Hosted template registry & analytics.** Pro tier for orgs: private template registry, drift dashboards, audit logs.
2. **Team sync server.** Optional self-hostable backend for sharing `/agent` overlays across many repos (think Renovate for agent memory).
3. **AI-assisted authoring (opt-in).** Paid tier where LLM helps draft architecture.md/domain-knowledge.md from scanner output. Keep OSS core LLM-free.
4. **Enterprise compliance pack.** SSO, audit, policy enforcement (e.g., "all repos must define security workflows"), SOC2 attestations.
5. **Managed GitHub App.** Auto-PRs to keep agent files synced across an org's repos. Per-repo or per-seat pricing.
6. **Adapter marketplace revenue share.** If vendors (Cursor, Cline, etc.) want certified adapters with SLAs.
7. **Training / consulting.** Workshops on "AI-ready repos" — common monetization for popular dev tools.
8. **Sponsorship / GitHub Sponsors** as bridge revenue.

Order of seriousness: 1 → 5 → 2. Avoid 3 until the LLM-free brand is firmly established — switching too early dilutes positioning.

---

**Bottom line:** ship M1 + M2 in 21 days, get the demo right, treat scanners and team features as the moat after adoption. The killer wedge is **"one file, every agent, deterministic"** — protect that simplicity ruthlessly.
