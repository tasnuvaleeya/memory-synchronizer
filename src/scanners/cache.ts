import path from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { CONFIG_DIR } from "../core/paths.js";
import type { FileRole } from "./types.js";

const CACHE_DIR = "cache";
const CACHE_FILENAME = "scan.json";

export interface CacheEntry {
  sha: string;
  lineCount: number;
  language: string | null;
  role: FileRole;
}

export type ScanCache = Record<string, CacheEntry>;

export function cachePath(cwd: string): string {
  return path.join(cwd, CONFIG_DIR, CACHE_DIR, CACHE_FILENAME);
}

export async function loadCache(cwd: string): Promise<ScanCache> {
  try {
    const raw = await readFile(cachePath(cwd), "utf8");
    const parsed = JSON.parse(raw) as ScanCache;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveCache(cwd: string, cache: ScanCache): Promise<void> {
  const file = cachePath(cwd);
  await mkdir(path.dirname(file), { recursive: true });
  // Deterministic key order
  const sorted: ScanCache = {};
  for (const key of Object.keys(cache).sort()) {
    sorted[key] = cache[key]!;
  }
  await writeFile(file, JSON.stringify(sorted, null, 2) + "\n", "utf8");
}
