import path from "node:path";
import { existsSync } from "node:fs";
import { stat, readFile } from "node:fs/promises";
import { type Logger, colors } from "../core/logger.js";
import { UserError } from "../core/errors.js";
import { resolveCwd, agentDir } from "../core/paths.js";
import { loadMemorySet, loadConfig, loadManifest } from "../core/load.js";
import { resolveAdapters, listBuiltInAdapters } from "../adapters/registry.js";
import { loadLastSync } from "../core/drift.js";
import { contentChecksum } from "../core/provenance.js";
import { computeSourceSha } from "../adapters/base.js";
import type { RenderContext } from "../adapters/base.js";

export interface StatsOptions {
  json?: boolean;
}

interface FileStats {
  path: string;
  chars: number;
  estimatedTokens: number;
  mtime: string;
}

interface AdapterStats {
  adapter: string;
  outputPaths: string[];
  estimatedTokens: number;
  driftStatus: "clean" | "drifted" | "missing";
}

export async function statsCommand(
  cwd: string | undefined,
  opts: StatsOptions,
  logger: Logger,
): Promise<void> {
  const root = resolveCwd(cwd);
  const dir = agentDir(root);
  if (!existsSync(dir)) {
    throw new UserError(`No \`agent/\` directory found. Run \`agentsync init\` first.`);
  }

  const [manifest, memory, config] = await Promise.all([
    loadManifest(root),
    loadMemorySet(root),
    loadConfig(root),
  ]);

  // Per-file stats
  const files: FileStats[] = [];
  for (const f of memory.files) {
    let mtime = new Date().toISOString();
    try {
      const s = await stat(path.join(dir, f.path));
      mtime = new Date(s.mtimeMs).toISOString();
    } catch {
      // best-effort
    }
    files.push({
      path: f.path,
      chars: f.body.length,
      estimatedTokens: Math.ceil(f.body.length / 4),
      mtime,
    });
  }

  // Per-adapter stats (token counts + drift)
  const manifestTargets = new Set(manifest.targets);
  const configDefaults = new Set(config.defaultAdapters);
  const adapterNames = listBuiltInAdapters().filter(
    (n) => manifestTargets.has(n) || configDefaults.has(n),
  );
  const adapters = await resolveAdapters(adapterNames);
  const lastSync = await loadLastSync(root);

  const now = new Date().toISOString();
  const ctx: RenderContext = {
    projectName: manifest.project.name,
    manifestVersion: manifest.version,
    tokenBudget: config.tokenBudgets["*"] ?? null,
    priorityOrder: memory.files.slice().sort((a, b) => a.frontmatter.priority - b.frontmatter.priority).map((f) => f.path),
    generatorVersion: "stats",
    now,
  };

  const sourceSha = computeSourceSha(memory);
  const adapterStats: AdapterStats[] = [];

  for (const adapter of adapters) {
    const generated = await adapter.render(memory, ctx);
    let totalChars = 0;
    let drift: AdapterStats["driftStatus"] = "clean";

    for (const g of generated) {
      totalChars += g.contents.length;
      const absPath = path.join(root, g.path);
      if (!existsSync(absPath)) {
        drift = "missing";
        continue;
      }
      const onDisk = await readFile(absPath, "utf8");
      const onDiskChecksum = contentChecksum(onDisk);
      const record = lastSync[g.path];
      if (record && onDiskChecksum !== record.contentChecksum && drift !== "missing") {
        drift = "drifted";
      }
    }

    adapterStats.push({
      adapter: adapter.name,
      outputPaths: [...adapter.outputPaths],
      estimatedTokens: Math.ceil(totalChars / 4),
      driftStatus: drift,
    });
  }

  if (opts.json) {
    logger.print(
      JSON.stringify(
        {
          project: manifest.project.name,
          sourceSha,
          files,
          adapters: adapterStats,
          totals: {
            files: files.length,
            chars: files.reduce((sum, f) => sum + f.chars, 0),
            estimatedTokens: files.reduce((sum, f) => sum + f.estimatedTokens, 0),
          },
        },
        null,
        2,
      ),
    );
    return;
  }

  // Human output
  logger.print(colors.bold(`agentsync stats — ${manifest.project.name}`));
  logger.print("");
  logger.print(colors.bold("Memory files:"));
  for (const f of files) {
    logger.print(`  ${f.path}  ${colors.dim(`${f.chars} chars, ~${f.estimatedTokens} tokens`)}`);
  }
  logger.print("");
  logger.print(colors.bold("Adapters:"));
  for (const a of adapterStats) {
    const driftLabel = a.driftStatus === "clean"
      ? colors.green("clean")
      : a.driftStatus === "drifted"
        ? colors.red("drifted")
        : colors.yellow("missing");
    logger.print(`  ${a.adapter}  ${colors.dim(`~${a.estimatedTokens} tokens`)}  ${driftLabel}`);
  }
}
