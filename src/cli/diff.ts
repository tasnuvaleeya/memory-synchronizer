import path from "node:path";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { type Logger, colors } from "../core/logger.js";
import { UserError } from "../core/errors.js";
import { resolveCwd, agentDir } from "../core/paths.js";
import { loadManifest, loadMemorySet, loadConfig } from "../core/load.js";
import { resolveAdapters, listBuiltInAdapters } from "../adapters/registry.js";
import { loadLastSync } from "../core/drift.js";
import { stripProvenance, contentChecksum } from "../core/provenance.js";
import type { RenderContext } from "../adapters/base.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface DiffOptions {
  json?: boolean;
}

interface FileDiff {
  path: string;
  adapter: string;
  status: "new" | "up-to-date" | "would-update" | "drifted";
  onDiskChecksum: string | undefined;
  generatedChecksum: string;
  sourceSha: string;
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

export async function diffCommand(
  cwd: string | undefined,
  adapterArg: string | undefined,
  opts: DiffOptions,
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

  let adapterNames: string[];
  if (adapterArg) {
    adapterNames = [adapterArg];
  } else {
    const manifestTargets = new Set(manifest.targets);
    const configDefaults = new Set(config.defaultAdapters);
    adapterNames = listBuiltInAdapters().filter(
      (n) => manifestTargets.has(n) || configDefaults.has(n),
    );
  }

  const adapters = await resolveAdapters(adapterNames);
  if (adapters.length === 0) {
    throw new UserError(`No adapters resolved for: ${adapterNames.join(", ")}.`);
  }

  const now = new Date().toISOString();
  const generatorVersion = loadVersion();

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
  const diffs: FileDiff[] = [];

  for (const adapter of adapters) {
    const files = await adapter.render(memory, ctx);

    for (const generated of files) {
      const absPath = path.join(root, generated.path);
      const record = lastSync[generated.path];

      let status: FileDiff["status"];
      let onDiskChecksum: string | undefined;

      if (!existsSync(absPath)) {
        status = "new";
      } else {
        const onDiskRaw = await readFile(absPath, "utf8");
        onDiskChecksum = contentChecksum(onDiskRaw);

        if (record && onDiskChecksum !== record.contentChecksum) {
          status = "drifted";
        } else if (onDiskChecksum === generated.checksum) {
          status = "up-to-date";
        } else {
          status = "would-update";
        }
      }

      diffs.push({
        path: generated.path,
        adapter: adapter.name,
        status,
        onDiskChecksum,
        generatedChecksum: generated.checksum,
        sourceSha: generated.sourceSha,
      });

      if (!opts.json) {
        printDiffEntry(generated.path, status, adapter.name, logger);
        if (status === "would-update" || status === "new") {
          const onDiskContent = existsSync(absPath)
            ? stripProvenance(await readFile(absPath, "utf8"))
            : "";
          const newContent = stripProvenance(generated.contents);
          printInlineDiff(onDiskContent, newContent, logger);
        }
      }
    }
  }

  if (opts.json) {
    logger.print(JSON.stringify({ diffs }, null, 2));
  }
}

function printDiffEntry(
  filePath: string,
  status: FileDiff["status"],
  adapter: string,
  logger: Logger,
): void {
  const statusLabel = {
    new: colors.green("new"),
    "up-to-date": colors.dim("up-to-date"),
    "would-update": colors.yellow("would-update"),
    drifted: colors.red("drifted (manually edited)"),
  }[status];
  logger.print(`${colors.bold(filePath)} [${adapter}] ${statusLabel}`);
}

function printInlineDiff(before: string, after: string, logger: Logger): void {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");

  // Simple unified-style diff (additions/removals only, no context)
  const maxLen = Math.max(beforeLines.length, afterLines.length);
  let hasDiff = false;
  for (let i = 0; i < maxLen; i++) {
    const a = beforeLines[i];
    const b = afterLines[i];
    if (a !== b) {
      if (!hasDiff) logger.print("");
      hasDiff = true;
      if (a !== undefined) logger.print(colors.red(`- ${a}`));
      if (b !== undefined) logger.print(colors.green(`+ ${b}`));
    }
  }
  if (hasDiff) logger.print("");
}
