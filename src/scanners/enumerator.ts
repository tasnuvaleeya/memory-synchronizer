import { globby } from "globby";
import path from "node:path";
import { existsSync } from "node:fs";
import { compareStrings, ignorePath, toPosix } from "../core/paths.js";

/**
 * Phase-1 default ignore patterns. The user's `.gitignore` and
 * `agent/.agentsyncignore` are layered on top of this list.
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
  ".agentsync/cache/**",
  // Scan's own outputs — including them would be self-referential and break
  // idempotency (each run would mutate its inputs).
  "agent/repo-map.json",
  "agent/stack.md",
  // Adapter outputs produced by `agentsync sync`. Excluding them keeps the
  // scan → sync → scan fixpoint stable: file count and stack.md body don't
  // shift after the first sync.
  "CLAUDE.md",
  "AGENTS.md",
  ".cursorrules",
  ".cursor/rules/**",
  ".clinerules",
  ".windsurfrules",
  ".github/copilot-instructions.md",
];

/**
 * Enumerate every (non-ignored, non-binary-by-path) file in the repo.
 * Returns repo-relative POSIX paths, sorted deterministically.
 */
export async function enumerateFiles(cwd: string): Promise<string[]> {
  const ignoreFiles: string[] = [];
  // agent/.agentsyncignore — only include if it exists (globby errors otherwise)
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
