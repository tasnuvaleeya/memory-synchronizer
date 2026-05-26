# agentsync

> A shared, repo-local memory layer that synchronizes context across AI coding tools.

Stop re-explaining your repo to every AI agent. Maintain one `/agent` directory; sync to `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, and more.

## Status

Milestone 1 — Core Memory Layer (in progress).

Currently supported commands:

- `agentsync init` — scaffold a fresh `/agent` directory
- `agentsync validate` — validate manifest, frontmatter, and links
- `agentsync show <file>` — render a memory file with its metadata
- `agentsync version` — print version

Sync, scan, and adapters land in Milestone 2 and 3 — see [`features/feature-plan.md`](./features/feature-plan.md).

## Requirements

- Node.js 20 or newer

## Install (dev)

```bash
npm install
npm run build
npm link
agentsync --help
```

## Quick start

```bash
cd your-repo
agentsync init
agentsync validate
agentsync show agent/coding-rules.md
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run build` | Compile the CLI (ESM + CJS) and regenerate JSON Schemas under `docs/schema/v1/`. |
| `npm run dev` | Watch-mode build. |
| `npm run test:run` | Run the Vitest suite once. |
| `npm run typecheck` | Strict TypeScript check without emit. |
| `npm run lint` | ESLint over `src/` and `tests/`. |
| `npm run schema:export` | Regenerate the JSON Schemas only. |

## Project layout

```
src/
├── cli/        # commander entry + command modules
├── core/       # Zod schemas, loaders, frontmatter parser, paths
├── index.ts    # public library surface
templates/
└── starter/    # bundled scaffold copied by `agentsync init`
docs/schema/v1/ # JSON Schemas generated from Zod
tests/          # Vitest suites
```

## License

MIT
