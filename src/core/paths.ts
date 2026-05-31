import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const AGENT_DIR = "agent";
export const MANIFEST_FILENAME = "manifest.yaml";
export const CONFIG_DIR = ".agentctx";
export const CONFIG_FILENAME = "config.yaml";
export const IGNORE_FILENAME = ".agentctxignore";

export function resolveCwd(cwd?: string): string {
  return cwd ? path.resolve(cwd) : process.cwd();
}

export function agentDir(cwd: string): string {
  return path.join(cwd, AGENT_DIR);
}

export function manifestPath(cwd: string): string {
  return path.join(agentDir(cwd), MANIFEST_FILENAME);
}

export function configPath(cwd: string): string {
  return path.join(cwd, CONFIG_DIR, CONFIG_FILENAME);
}

export function ignorePath(cwd: string): string {
  return path.join(agentDir(cwd), IGNORE_FILENAME);
}

/** Repo-relative POSIX path for deterministic display & storage. */
export function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

/** Locale-independent string comparator (avoids `localeCompare`). */
export function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** SHA-256 of arbitrary input. */
export function sha256(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Single I/O boundary for writes: always LF-terminated, always creates the
 * parent directory. This is the only write helper we use from M1 onward —
 * cross-OS determinism hinges on a single normalization point.
 */
export async function writeFileLF(filePath: string, contents: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const normalized = contents.replace(/\r\n/g, "\n");
  await writeFile(filePath, normalized, "utf8");
}

export async function readFileUtf8(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}

/**
 * Locate the directory that ships bundled templates. Resolves the same path
 * for both dev (running TS from `src/`) and prod (running bundled JS from
 * `dist/`), since both live one level deep inside the package root.
 */
export function templatesDir(callerUrl: string): string {
  const here = path.dirname(fileURLToPath(callerUrl));
  return path.resolve(here, "..", "..", "templates");
}
