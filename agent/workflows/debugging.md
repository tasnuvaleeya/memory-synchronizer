---
name: debugging-workflow
description: How to investigate failures in agentsync.
source: authored
priority: 60
applies_to: ["*"]
tags: [workflow, debugging]
---

# Debugging workflow

## Reproduce in a scratch dir first

Most CLI bugs are easiest to reproduce against a fresh `agentsync init` repo:

```sh
cd /tmp && mkdir scratch && cd scratch
node /path/to/repo/dist/cli/index.js init --yes
node /path/to/repo/dist/cli/index.js <command>
```

This isolates the failure from any state in the working repo.

## Common failure modes

### "Drift detected" but I didn't touch anything

- Look at `.agentsync/last-sync.json`. The `contentChecksum` should match the file's actual checksum after provenance strip.
- Inspect the generated file's provenance header — if `generated-at` was stripped (it should be), the checksum check uses the rest of the content.
- Likely cause: someone manually saved the generated file from an editor that touched line endings (CRLF) or trailing whitespace. Re-save with LF endings.

### "No `agent/` directory found"

- The command was run from a directory above the repo root, or `agent/` was renamed. Pass `--cwd <repo>` to override.

### `agentsync scan` shows wrong language for a file

- Check `src/scanners/languageMap.ts` for the extension mapping. Or add an override via `.agentsync/config.yaml`:
  ```yaml
  languageMap:
    nim: Nim
  ```

### Imports broken after working on adapters

- Adapter files **must** import from `@agentsync/adapter-sdk`, not from `../base.js` directly. The legacy `../base.js` path is a re-export layer; new adapters should bypass it.
- Run `pnpm install` to re-establish workspace links if you've moved files between packages.

### MCP server isn't responding

- `agentsync mcp` is launched by the MCP client. Running it bare in a terminal looks broken — it's waiting on stdin for JSON-RPC.
- Test with `echo '{"jsonrpc":"2.0","id":1,"method":"resources/list"}' | agentsync mcp`.

## Logging knobs

- `--verbose` — `Logger.debug()` calls are emitted to stderr.
- `--json` — flips structured output on stdout (the human-readable text is suppressed).
- `--no-color` or `NO_COLOR=1` — disables ANSI codes (also auto-disabled when piped).

## When you find a determinism bug

1. Reproduce with two clean runs in a fresh dir, confirming byte mismatch.
2. Bisect by commenting out individual sort steps or timestamp inclusions in the generator.
3. Add a vitest fixture under `tests/` that exercises the failing path.
4. Fix at the smallest scope. If the bug is in a `sort()` call, the fix is `compareStrings`. If it's in a date field, the fix is to remove it or strip it before comparison.
5. Cross-check on macOS, Linux, and Windows if at all possible.
