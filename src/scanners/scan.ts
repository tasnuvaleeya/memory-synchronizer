import path from "node:path";
import { compareStrings } from "../core/paths.js";
import type { Config } from "../core/config.js";
import { enumerateFiles } from "./enumerator.js";
import { measureFile } from "./lineCounter.js";
import { resolveLanguage } from "./languageMap.js";
import { classifyRole } from "./roleClassifier.js";
import { buildTree } from "./treeBuilder.js";
import { detectStack } from "./stackDetector.js";
import {
  loadCache,
  saveCache,
  type ScanCache,
  type CacheEntry,
} from "./cache.js";
import type {
  FileFact,
  LanguageSummary,
  RepoMap,
  ScanResult,
} from "./types.js";

export interface ScanOptions {
  /** Frozen timestamp for determinism in generated artifacts. */
  now: string;
  /** Ignore the on-disk cache for this run. */
  noCache?: boolean;
  /** Optional config override (default: empty languageMap). */
  config?: Pick<Config, "languageMap">;
}

export async function scan(cwd: string, opts: ScanOptions): Promise<ScanResult> {
  const paths = await enumerateFiles(cwd);
  const overrides = opts.config?.languageMap ?? {};

  const cache: ScanCache = opts.noCache ? {} : await loadCache(cwd);
  const nextCache: ScanCache = {};

  const files: FileFact[] = [];
  for (const rel of paths) {
    const abs = path.join(cwd, rel);
    const { sha, lineCount, isText } = await measureFile(abs);
    const cached = cache[rel];

    let entry: CacheEntry;
    if (cached && cached.sha === sha) {
      entry = cached;
    } else {
      entry = {
        sha,
        lineCount: isText ? lineCount : 0,
        language: resolveLanguage(rel, overrides),
        role: classifyRole(rel),
      };
    }
    nextCache[rel] = entry;

    files.push({
      path: rel,
      role: entry.role,
      language: entry.language,
      lineCount: entry.lineCount,
      sha: entry.sha,
    });
  }

  if (!opts.noCache) await saveCache(cwd, nextCache);

  // Language histogram — sorted by lines desc, then language asc for stable tie-breaks
  const histMap = new Map<string, { files: number; lines: number }>();
  let totalLines = 0;
  for (const f of files) {
    totalLines += f.lineCount;
    if (!f.language) continue;
    const cur = histMap.get(f.language) ?? { files: 0, lines: 0 };
    cur.files += 1;
    cur.lines += f.lineCount;
    histMap.set(f.language, cur);
  }
  const languages: LanguageSummary[] = Array.from(histMap.entries())
    .map(([language, v]) => ({ language, files: v.files, lines: v.lines }))
    .sort((a, b) => {
      if (a.lines !== b.lines) return b.lines - a.lines;
      return compareStrings(a.language, b.language);
    });

  const rootName = path.basename(cwd) || "(root)";
  const tree = buildTree(files, rootName);

  const repoMap: RepoMap = {
    version: 1,
    summary: {
      totalFiles: files.length,
      totalLines,
      languages,
    },
    tree,
    files,
  };

  const stack = await detectStack(cwd);

  return { repoMap, stack };
}
