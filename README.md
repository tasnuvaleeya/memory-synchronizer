# agentsync

> A shared, repo-local memory layer that synchronizes context across AI coding tools.

Stop re-explaining your repo to every AI agent. Maintain one `agent/` directory; sync to `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `.cursor/rules/*.mdc`, `.clinerules`, `.windsurfrules`, and `.github/copilot-instructions.md` — all from a single command.

Deterministic. Local-first. LLM-free in the default path.

## Documentation

- **[User manual](./docs/manual.md)** — complete reference: concepts, every command, configuration, team policy, CI integration, troubleshooting.
- **[MCP integration guide](./docs/mcp.md)** — wire `agentsync` into Claude Desktop, Claude Code, or any MCP client.
- **[Adapter SDK](./packages/adapter-sdk/README.md)** — write your own adapter for any new AI tool.
- **[JSON Schemas](./docs/schema/v1/)** — machine-readable schemas for `manifest.yaml`, `Frontmatter`, `Config`, `Policy`, `RepoMap`, `Stack`, and `MemoryFile`.

## Quickstart

```bash
cd your-repo
agentsync init        # scaffold agent/ with starter templates
agentsync sync        # generate CLAUDE.md, AGENTS.md, .cursorrules, …
agentsync scan        # auto-detect tech stack into agent/stack.md
agentsync lint        # check your memory files
```

That's the loop. Full walkthrough in the [manual](./docs/manual.md).

## Commands at a glance

| Command | Purpose |
|---|---|
| `agentsync init` | Scaffold a fresh `agent/` directory |
| `agentsync validate` | Validate manifest, frontmatter, links |
| `agentsync show <file>` | Pretty-print a memory file |
| `agentsync sync` | Regenerate per-tool context files |
| `agentsync diff [adapter]` | Preview what `sync` would change |
| `agentsync scan` | Walk the repo, build `repo-map.json` + `stack.md` |
| `agentsync lint` | Lint memory files against built-in rules |
| `agentsync stats` | Per-adapter token counts + drift status |
| `agentsync export <path>` | Bundle `agent/` into a portable `.tar.gz` |
| `agentsync import <source>` | Pull a starter `agent/` from a path, tarball, or git URL |
| `agentsync install-hook` | Install a git pre-commit hook |
| `agentsync mcp` | Run a read-only MCP server exposing `agent/` |
| `agentsync version` | Print version |

Every command supports `--json` for scripting. Exit codes: `0` OK, `1` user error, `2` drift detected (CI signal), `3` internal error.

## Requirements

- Node.js 20 or newer
- A package manager (`pnpm` recommended)

## Install (dev)

Until `@agentsync/cli` is published on the public npm registry:

```bash
git clone https://github.com/tasnuvaleeya/memory-synchronizer
cd memory-synchronizer
pnpm install
pnpm run build
npm link
agentsync --help
```

## Built-in adapters

`agentsync sync` produces one or more of the following files based on your manifest's `targets`:

| Adapter | Output |
|---|---|
| `claude` | `CLAUDE.md` |
| `agents-md` | `AGENTS.md` |
| `cursor` | `.cursorrules` + `.cursor/rules/agentsync.mdc` |
| `cline` | `.clinerules` |
| `windsurf` | `.windsurfrules` |
| `copilot` | `.github/copilot-instructions.md` |

Write your own for any new tool via [`@agentsync/adapter-sdk`](./packages/adapter-sdk/README.md).

## Scripts

| Command | What it does |
|---|---|
| `pnpm run build` | Build the CLI (ESM + CJS) and regenerate JSON Schemas |
| `pnpm run dev` | Watch-mode build |
| `pnpm run test:run` | Run the Vitest suite once |
| `pnpm run typecheck` | Strict TypeScript check |
| `pnpm run lint` | ESLint over `src/` and `tests/` |
| `pnpm run schema:export` | Regenerate just the JSON Schemas |

## Project layout

```
src/
├── cli/             # commander entry + command modules
├── core/            # Zod schemas, loaders, frontmatter parser, paths
├── adapters/        # 6 built-in adapters + lazy registry
├── scanners/        # filesystem walk + stack detector
├── generators/      # pure markdown/JSON emitters (stack.md, repo-map.json)
├── linter/          # rule engine + 5 built-in rules
└── mcp/             # read-only MCP server
packages/
├── adapter-sdk/     # public SDK for third-party adapters
└── action/          # GitHub Action wrapper
templates/starter/   # scaffold copied by `agentsync init`
docs/                # manual, MCP guide, JSON Schemas
tests/               # Vitest suites
```

## License

MIT
