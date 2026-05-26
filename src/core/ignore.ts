import { readFile } from "node:fs/promises";

/**
 * Read a gitignore-style file and return the non-empty, non-comment lines.
 * Suitable for passing into globby's `ignore` option.
 *
 * Returns `[]` if the file does not exist (errors other than ENOENT bubble up).
 */
export async function readIgnoreFile(filePath: string): Promise<string[]> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  return parseIgnoreLines(raw);
}

export function parseIgnoreLines(contents: string): string[] {
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}
