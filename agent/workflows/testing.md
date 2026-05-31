---
name: testing-workflow
description: How agentsync is tested.
source: authored
priority: 60
applies_to: ["*"]
tags: [workflow, testing]
---

# Testing workflow

## Test runners

- **Main package:** `vitest` via `pnpm run test` (watch mode) or `pnpm run test:run` (single pass).
- **`packages/adapter-sdk`:** also `vitest`, runs in the sub-package via `pnpm --filter @agentsync/adapter-sdk run test`.
- **`packages/action`:** has a unit test but isn't wired into the root vitest config (separate sub-package; tests run when we publish the action).

## Test layout

- `tests/<feature>.test.ts` — one file per CLI command or core module.
- `tests/scanners/<thing>.test.ts` — scanner-specific unit tests.
- `tests/fixtures/` — minimal mini-repos for integration tests (rarely used; we mostly use `mkdtemp` + `initCommand`).

## Patterns

- **`mkdtemp` + real fs** is the default. We've found that mocking the filesystem hides determinism bugs.
- **Run `initCommand` to seed a temp dir** — most CLI commands need a real `agent/` to operate against.
- **CapturingLogger pattern** when asserting on stdout: subclass `Logger` and override `print()` to push into an array, then `JSON.parse` and assert on the structured shape.

## Adding tests for a new CLI command

1. Add `tests/<command>.test.ts` mirroring an existing one (e.g., `tests/lint.test.ts`).
2. `beforeEach`: `mkdtemp` + `initCommand`.
3. `afterEach`: `rm` recursive force.
4. For `--json` output, parse and assert structure; for stderr/stdout shape, use `CapturingLogger`.
5. For drift / round-trip tests, write a "first run, mutate state, second run" pattern.

## Known limitations

- **`tests/init.test.ts` "produces byte-identical output across runs (determinism)" is flaky on macOS/Linux due to mtime/parent-dir-name differences.** This is a pre-existing issue from M1 that is unrelated to current work. Don't fix it as part of an unrelated PR. The other 135 tests are stable.

## Verifying the whole project

```sh
pnpm run typecheck      # strict TypeScript across packages
pnpm run test:run       # vitest single-pass
pnpm run build          # tsup + schema export
pnpm --filter @agentsync/adapter-sdk run build  # build the SDK
```

Before opening a PR: `agentsync sync --check && agentsync lint && agentsync scan --check` should all exit 0. CI runs the same via the bundled GitHub Action (`.github/workflows/agentsync.yml`).
