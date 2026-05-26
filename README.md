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

Sync, scan, and adapters land in Milestone 2 and 3 — see `features/feature-plan.md`.

## Install (dev)

```bash
pip install -e .
agentsync --help
```

## Quick start

```bash
cd your-repo
agentsync init
agentsync validate
agentsync show agent/coding-rules.md
```

## License

MIT
