import path from "node:path";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { type Logger } from "../core/logger.js";
import { UserError, DriftError } from "../core/errors.js";
import { resolveCwd, writeFileLF, agentDir } from "../core/paths.js";
import { loadManifest, loadMemorySet, loadConfig } from "../core/load.js";
import { resolveAdapters, listBuiltInAdapters } from "../adapters/registry.js";
import {
  checkDrift,
  loadLastSync,
  saveLastSync,
  type LastSyncMap,
} from "../core/drift.js";
import { contentChecksum } from "../core/provenance.js";
import type { RenderContext } from "../adapters/base.js";
import { computeSourceSha } from "../adapters/base.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface SyncOptions {
  check?: boolean;
  adapter?: string[];
  dryRun?: boolean;
  force?: boolean;
  json?: boolean;
}

interface SyncResult {
  written: string[];
  skipped: string[];
  drifted: string[];
  upToDate: string[];
}

function loadVersion(): string {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const pkgPath = path.resolve(here, "..", "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
    return pkg.version;
  } catch {
    return "0.0.0";
  }
}

export async function syncCommand(
  cwd: string | undefined,
  opts: SyncOptions,
  logger: Logger,
): Promise<void> {
  const root = resolveCwd(cwd);
  const dir = agentDir(root);

  if (!existsSync(dir)) {
    throw new UserError(
      `No \`agent/\` directory found. Run \`agentctx init\` first.`,
    );
  }

  const [manifest, memory, config] = await Promise.all([
    loadManifest(root),
    loadMemorySet(root),
    loadConfig(root),
  ]);

  // Resolve which adapters to run
  let adapterNames: string[];
  if (opts.adapter && opts.adapter.length > 0) {
    adapterNames = opts.adapter;
  } else {
    const manifestTargets = new Set(manifest.targets);
    const configDefaults = new Set(config.defaultAdapters);
    adapterNames = listBuiltInAdapters().filter(
      (n) => manifestTargets.has(n) || configDefaults.has(n),
    );
  }

  const adapters = await resolveAdapters(adapterNames);
  if (adapters.length === 0) {
    throw new UserError(
      `No adapters resolved for: ${adapterNames.join(", ")}. Check manifest.targets and .agentctx/config.yaml.`,
    );
  }

  const now = new Date().toISOString();
  const generatorVersion = loadVersion();
  const sourceSha = computeSourceSha(memory);

  const ctx: RenderContext = {
    projectName: manifest.project.name,
    manifestVersion: manifest.version,
    tokenBudget: config.tokenBudgets["*"] ?? null,
    priorityOrder: memory.files
      .slice()
      .sort((a, b) => a.frontmatter.priority - b.frontmatter.priority)
      .map((f) => f.path),
    generatorVersion,
    now,
  };

  const lastSync = await loadLastSync(root);
  const result: SyncResult = { written: [], skipped: [], drifted: [], upToDate: [] };
  const nextSync: LastSyncMap = { ...lastSync };

  for (const adapter of adapters) {
    logger.debug(`Rendering adapter: ${adapter.name}`);
    const files = await adapter.render(memory, ctx);

    for (const generated of files) {
      const absPath = path.join(root, generated.path);
      const drift = await checkDrift(generated.path, absPath, lastSync);

      if (drift.kind === "drifted" && !opts.force) {
        result.drifted.push(generated.path);
        if (!opts.check) {
          logger.warn(
            `${generated.path}: manually edited — run \`agentctx diff ${adapter.name}\` to inspect, then use \`--force\` to overwrite.`,
          );
        }
        continue;
      }

      // Check if already up-to-date (idempotent sync)
      if (existsSync(absPath)) {
        const onDiskRaw = await readFile(absPath, "utf8");
        const onDiskChecksum = contentChecksum(onDiskRaw);
        if (onDiskChecksum === generated.checksum) {
          result.upToDate.push(generated.path);
          nextSync[generated.path] = {
            sourceSha,
            contentChecksum: generated.checksum,
            syncedAt: now,
          };
          continue;
        }
      }

      if (opts.dryRun || opts.check) {
        result.written.push(generated.path);
      } else {
        await writeFileLF(absPath, generated.contents);
        result.written.push(generated.path);
        nextSync[generated.path] = {
          sourceSha,
          contentChecksum: generated.checksum,
          syncedAt: now,
        };
        logger.success(`Synced ${generated.path}`);
      }
    }
  }

  if (!opts.dryRun && !opts.check) {
    await saveLastSync(root, nextSync);
  }

  if (opts.json) {
    logger.print(JSON.stringify({ ok: result.drifted.length === 0, ...result }, null, 2));
  } else if (opts.check) {
    if (result.drifted.length > 0) {
      logger.error(`Drift detected in: ${result.drifted.join(", ")}`);
    }
    if (result.written.length > 0) {
      logger.warn(`Would update: ${result.written.join(", ")}`);
    }
    if (result.upToDate.length > 0) {
      logger.info(`Up to date: ${result.upToDate.join(", ")}`);
    }
  } else if (!opts.dryRun) {
    if (result.upToDate.length > 0) {
      logger.info(`Up to date: ${result.upToDate.join(", ")}`);
    }
  }

  if (result.drifted.length > 0) {
    throw new DriftError(
      `Drift detected in ${result.drifted.length} file(s). Run \`agentctx diff\` to inspect.`,
    );
  }
}
