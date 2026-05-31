import { globby } from "globby";
import path from "node:path";
import { existsSync } from "node:fs";
import { compareStrings, ignorePath, toPosix } from "../core/paths.js";

/**
 * Phase-1 default ignore patterns. The user's `.gitignore` and
 * `agent/.agentctxignore` are layered on top of this list.
 */
export const DEFAULT_IGNORES: string[] = [
  "node_modules",
  "**/node_modules/**",
  ".git",
  "**/.git/**",
  "dist",
  "**/dist/**",
  ".next",
  "**/.next/**",
  "build",
  "**/build/**",
  "coverage",
  "**/coverage/**",
  ".venv",
  "**/.venv/**",
  "venv",
  "**/venv/**",
  "__pycache__",
  "**/__pycache__/**",
  "target",
  "**/target/**",
  ".turbo",
  "**/.turbo/**",
  ".cache",
  "**/.cache/**",
  ".agentctx/cache/**",
  ".agentctx/last-sync.json",
  // Per-developer AI tool state that isn't typically checked into git.
  // Including it makes scan output diverge between contributors and CI.
  ".claude/**",
  ".aider*",
  "**/.aider*",
  // Scan's own outputs — including them would be self-referential and break
  // idempotency (each run would mutate its inputs).
  "agent/repo-map.json",
  "agent/stack.md",
  // Adapter outputs produced by `agentctx sync`. Excluding them keeps the
  // scan → sync → scan fixpoint stable: file count and stack.md body don't
  // shift after the first sync.
  "CLAUDE.md",
  "AGENTS.md",
  ".cursorrules",
  ".cursor/rules/**",
  ".clinerules",
  ".windsurfrules",
  ".github/copilot-instructions.md",
  // Machine-maintained lockfiles. They're huge, can shift on install even
  // with --frozen-lockfile in package-manager edge cases, and don't
  // represent the "shape" of the codebase the way source files do.
  // Including them produces gratuitous scan-check drift in CI.
  "pnpm-lock.yaml",
  "**/pnpm-lock.yaml",
  "package-lock.json",
  "**/package-lock.json",
  "yarn.lock",
  "**/yarn.lock",
  "bun.lockb",
  "**/bun.lockb",
  "Cargo.lock",
  "**/Cargo.lock",
  "poetry.lock",
  "**/poetry.lock",
  "composer.lock",
  "**/composer.lock",
  "Gemfile.lock",
  "**/Gemfile.lock",
];

/**
 * Enumerate every (non-ignored, non-binary-by-path) file in the repo.
 * Returns repo-relative POSIX paths, sorted deterministically.
 */
export async function enumerateFiles(cwd: string): Promise<string[]> {
  const ignoreFiles: string[] = [];
  // agent/.agentctxignore — only include if it exists (globby errors otherwise)
  const aif = ignorePath(cwd);
  if (existsSync(aif)) {
    ignoreFiles.push(path.relative(cwd, aif));
  }

  const paths = await globby(["**/*"], {
    cwd,
    dot: true,
    gitignore: true,
    ignoreFiles,
    ignore: DEFAULT_IGNORES,
    onlyFiles: true,
    followSymbolicLinks: false,
  });

  return paths.map(toPosix).sort(compareStrings);
}
