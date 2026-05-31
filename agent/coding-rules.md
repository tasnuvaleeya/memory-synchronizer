---
name: coding-rules
description: Project-wide coding conventions for agentsync.
source: authored
priority: 20
applies_to: ["*"]
tags: [conventions, style]
---

# Coding rules

## TypeScript discipline

- **Strict + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`** are non-negotiable. The main package's `tsconfig.json` is the source of truth; sub-packages mirror it.
- **No `any` in `src/core/` or `packages/adapter-sdk/`.** Explicit types at every public boundary.
- **Use Zod at I/O boundaries.** Every YAML/JSON read goes through a schema. Inferred types (`z.infer<typeof X>`) flow inward; raw `unknown` does not.
- **`exactOptionalPropertyTypes` gotcha:** declare optional fields as `T | undefined` explicitly, not just `T?`. Zod-inferred types align with this automatically.

## Determinism rules

- **Always use `writeFileLF`** from `src/core/paths.ts`. Never call `fs.writeFile` directly.
- **Always sort lists with `compareStrings`.** `localeCompare` is forbidden — it produces different orderings under different system locales.
- **Never include a per-run timestamp inside generated content** unless the consumer strips it before comparison (see `stack.md` provenance handling).
- **The cache file (`.agentsync/cache/scan.json`) must serialize with sorted keys** so two clean runs produce byte-identical caches.

## Error handling

- Use the existing error classes from `src/core/errors.ts`:
  - `UserError` → exit code 1 (the user did something wrong)
  - `DriftError` → exit code 2 (CI signal that content is stale)
  - `InternalError` → exit code 3 (a bug in `agentsync`)
- Logs go to **stderr**; structured output (JSON for `--json` flag) goes to **stdout**. CLI consumers pipe stdout into `jq` or other tools.

## Module boundaries

- `core/` never imports from `cli/`. CLI imports core.
- Adapters import only from `@agentsync/adapter-sdk` — never from CLI internals. If you find yourself reaching into `src/cli/*` from an adapter, that's a signal the helper belongs in the SDK.
- Scanners, generators, and linter rules are pure (no I/O) wherever possible. Side effects live at the CLI handler layer.

## Commit conventions

- Short imperative subject. Body explains *why*, not *what*.
- **Never include `Co-Authored-By: Claude` trailers** in commit messages on this project.
- Bug fixes don't need surrounding cleanup; one-shot operations don't need a helper. Avoid premature abstraction.

## Testing

- Use `vitest` with the existing `tests/` layout. New test files match `tests/**/*.test.ts`.
- Prefer mkdtemp+real-fs over mocked filesystems — determinism bugs hide behind mocks.
- The single known failing test (`tests/init.test.ts` determinism) is pre-existing from M1 and unrelated to current work. Don't fix it as part of an unrelated PR.

## Comments

- Default to no comments. Only write one when the *why* is non-obvious (workaround for a specific bug, subtle invariant, surprising-but-correct choice).
- Don't write comments that explain WHAT — well-named identifiers do that already.
- Don't reference current task/fix/PR in comments — that belongs in the commit message and rots in code.
