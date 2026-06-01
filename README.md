# agentctx

> One file, every AI coding agent.

[![npm version](https://img.shields.io/npm/v/@agentctx/cli.svg?color=brightgreen)](https://www.npmjs.com/package/@agentctx/cli)
[![npm downloads](https://img.shields.io/npm/dm/@agentctx/cli.svg?color=blue)](https://www.npmjs.com/package/@agentctx/cli)
[![SDK](https://img.shields.io/npm/v/@agentctx/adapter-sdk.svg?label=%40agentctx%2Fadapter-sdk)](https://www.npmjs.com/package/@agentctx/adapter-sdk)
[![GitHub Action](https://img.shields.io/badge/GitHub%20Action-Marketplace-2ea44f?logo=github)](https://github.com/marketplace/actions/agentctx-sync-check)
[![CI](https://img.shields.io/github/actions/workflow/status/tasnuvaleeya/memory-synchronizer/ci.yml?branch=main&label=CI)](https://github.com/tasnuvaleeya/memory-synchronizer/actions)
[![License](https://img.shields.io/npm/l/@agentctx/cli.svg?color=blueviolet)](./LICENSE)
[![Node](https://img.shields.io/node/v/@agentctx/cli.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/typed-TypeScript-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

A shared, repo-local memory layer that synchronizes context across AI coding tools. Stop re-explaining your repo to every agent — maintain one `agent/` directory and sync to `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `.cursor/rules/*.mdc`, `.clinerules`, `.windsurfrules`, and `.github/copilot-instructions.md` from a single command.

**Deterministic. Local-first. LLM-free in the default path.**

## Install

```bash
npm install -g @agentctx/cli
```

Or run without installing:

```bash
npx -y @agentctx/cli init
```

Requires Node.js 20+.

## Quickstart

```bash
cd your-repo
agentctx init        # scaffold agent/ with starter templates
agentctx sync        # generate CLAUDE.md, AGENTS.md, .cursorrules, …
agentctx scan        # auto-detect tech stack into agent/stack.md
agentctx lint        # check your memory files
```

That's the loop. Full walkthrough in the [manual](./docs/manual.md).

## CI integration

Drop this into `.github/workflows/agentctx.yml` and PR-time drift becomes impossible:

```yaml
name: agentctx
on:
  pull_request:
    paths:
      - "agent/**"
      - "CLAUDE.md"
      - "AGENTS.md"
      - ".cursorrules"
      - ".cursor/rules/**"
      - ".clinerules"
      - ".windsurfrules"
      - ".github/copilot-instructions.md"
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: tasnuvaleeya/agentctx-action@v1
```

The action runs `agentctx sync --check` (drift detection) and `agentctx lint` (memory file quality) and surfaces findings as inline PR annotations. See the [Marketplace listing](https://github.com/marketplace/actions/agentctx-sync-check) for inputs/outputs.

## Documentation

- **[User manual](./docs/manual.md)** — concepts, every command, configuration, team policy, CI integration, troubleshooting, FAQ
- **[MCP integration guide](./docs/mcp.md)** — wire `agentctx` into Claude Desktop, Claude Code, or any MCP client
- **[Adapter SDK](./packages/adapter-sdk/README.md)** — write your own adapter for any new AI tool
- **[JSON Schemas](./docs/schema/v1/)** — machine-readable schemas for `manifest.yaml`, `Frontmatter`, `Config`, `Policy`, `RepoMap`, `Stack`, and `MemoryFile`

## Commands at a glance

| Command | Purpose |
|---|---|
| `agentctx init` | Scaffold a fresh `agent/` directory |
| `agentctx validate` | Validate manifest, frontmatter, links |
| `agentctx show <file>` | Pretty-print a memory file |
| `agentctx sync` | Regenerate per-tool context files |
| `agentctx diff [adapter]` | Preview what `sync` would change |
| `agentctx scan` | Walk the repo, build `repo-map.json` + `stack.md` |
| `agentctx lint` | Lint memory files against built-in rules |
| `agentctx stats` | Per-adapter token counts + drift status |
| `agentctx export <path>` | Bundle `agent/` into a portable `.tar.gz` |
| `agentctx import <source>` | Pull a starter `agent/` from a path, tarball, or git URL |
| `agentctx install-hook` | Install a git pre-commit hook |
| `agentctx mcp` | Run a read-only MCP server exposing `agent/` |
| `agentctx version` | Print version |

Every command supports `--json` for scripting. Exit codes: `0` OK, `1` user error, `2` drift detected (CI signal), `3` internal error.

## Built-in adapters

`agentctx sync` produces one or more of the following based on your manifest's `targets`:

| Adapter | Output | For |
|---|---|---|
| `claude` | `CLAUDE.md` | Claude Code |
| `agents-md` | `AGENTS.md` | Codex / OpenAI |
| `cursor` | `.cursorrules` + `.cursor/rules/agentctx.mdc` | Cursor |
| `cline` | `.clinerules` | Cline |
| `windsurf` | `.windsurfrules` | Windsurf |
| `copilot` | `.github/copilot-instructions.md` | GitHub Copilot |

Need support for another tool? Write a 50-line adapter using [`@agentctx/adapter-sdk`](./packages/adapter-sdk/README.md).

## MCP

Expose your `agent/` directory as Model Context Protocol resources to Claude Desktop, Claude Code, or any MCP client:

```jsonc
// claude_desktop_config.json
{
  "mcpServers": {
    "agentctx": {
      "command": "npx",
      "args": ["-y", "@agentctx/cli", "mcp"],
      "cwd": "/absolute/path/to/your/repo"
    }
  }
}
```

Full wiring guide in [docs/mcp.md](./docs/mcp.md).

## Contributing

Clone and bootstrap the workspace:

```bash
git clone https://github.com/tasnuvaleeya/memory-synchronizer
cd memory-synchronizer
pnpm install
pnpm --filter @agentctx/adapter-sdk run build
pnpm run build
npm link  # makes the `agentctx` binary available locally
```

| Script | What it does |
|---|---|
| `pnpm run build` | Build the CLI (ESM + CJS) and regenerate JSON Schemas |
| `pnpm run dev` | Watch-mode build |
| `pnpm run test:run` | Run the Vitest suite once |
| `pnpm run typecheck` | Strict TypeScript check |
| `pnpm run lint` | ESLint over `src/` and `tests/` |
| `pnpm run schema:export` | Regenerate just the JSON Schemas |

Before opening a PR, all of these should exit clean:

```bash
agentctx sync --check && agentctx scan --check && agentctx lint
pnpm run typecheck && pnpm run test:run && pnpm run build
```

The repo dogfoods itself — `agent/` and the per-tool outputs in this repo are produced by the same tool you're consuming.

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
├── adapter-sdk/     # @agentctx/adapter-sdk — public SDK for third-party adapters
└── action/          # GitHub Action wrapper (mirrored to tasnuvaleeya/agentctx-action)
templates/starter/   # scaffold copied by `agentctx init`
docs/                # manual, MCP guide, JSON Schemas
tests/               # Vitest suites
```

## Related

- 📦 [`@agentctx/cli`](https://www.npmjs.com/package/@agentctx/cli) — this package
- 📦 [`@agentctx/adapter-sdk`](https://www.npmjs.com/package/@agentctx/adapter-sdk) — types and helpers for adapter authors
- 🎬 [`tasnuvaleeya/agentctx-action`](https://github.com/tasnuvaleeya/agentctx-action) — the GitHub Action ([Marketplace](https://github.com/marketplace/actions/agentctx-sync-check))

## License

[MIT](./LICENSE)
