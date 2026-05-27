import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { CONFIG_DIR } from "./paths.js";
import { contentChecksum } from "./provenance.js";

const LAST_SYNC_FILENAME = "last-sync.json";

export interface SyncRecord {
  /** source SHA of /agent files that produced this output */
  sourceSha: string;
  /** checksum of the generated content (provenance stripped) */
  contentChecksum: string;
  /** ISO timestamp of last sync */
  syncedAt: string;
}

export type LastSyncMap = Record<string, SyncRecord>;

function lastSyncPath(cwd: string): string {
  return path.join(cwd, CONFIG_DIR, LAST_SYNC_FILENAME);
}

export async function loadLastSync(cwd: string): Promise<LastSyncMap> {
  const file = lastSyncPath(cwd);
  try {
    const raw = await readFile(file, "utf8");
    return JSON.parse(raw) as LastSyncMap;
  } catch {
    return {};
  }
}

export async function saveLastSync(cwd: string, map: LastSyncMap): Promise<void> {
  const file = lastSyncPath(cwd);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(map, null, 2) + "\n", "utf8");
}

export type DriftStatus =
  | { kind: "new" }
  | { kind: "clean" }
  | { kind: "drifted"; onDiskChecksum: string; lastChecksum: string };

/**
 * Three-way drift check:
 *   A = current /agent source SHA (what would be generated now)
 *   B = last-sync record's contentChecksum (what we last wrote)
 *   C = current on-disk file checksum (after provenance strip)
 *
 * B == C → clean (safe to overwrite)
 * B != C → human edited → drifted
 * no record → new (first sync)
 */
export async function checkDrift(
  outputPath: string,
  lastSync: LastSyncMap,
): Promise<DriftStatus> {
  const record = lastSync[outputPath];
  if (!record) return { kind: "new" };

  let onDiskRaw: string;
  try {
    onDiskRaw = await readFile(outputPath, "utf8");
  } catch {
    return { kind: "new" };
  }

  const onDiskChecksum = contentChecksum(onDiskRaw);
  if (onDiskChecksum === record.contentChecksum) return { kind: "clean" };

  return { kind: "drifted", onDiskChecksum, lastChecksum: record.contentChecksum };
}
