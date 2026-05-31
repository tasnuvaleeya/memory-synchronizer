import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { type Logger } from "../core/logger.js";
import { UserError, DriftError } from "../core/errors.js";
import { resolveCwd, agentDir, writeFileLF, toPosix, sha256 } from "../core/paths.js";
import { stripProvenance } from "../core/provenance.js";
import { loadManifest, loadConfig } from "../core/load.js";
import { scan } from "../scanners/scan.js";
import { renderRepoMap } from "../generators/repoMap.js";
import { renderStackMd } from "../generators/stack.js";

export interface ScanOptions {
  check?: boolean;
  incremental?: boolean;
  noCache?: boolean;
  json?: boolean;
}

interface ScanCommandResult {
  written: string[];
  upToDate: string[];
  wouldChange: string[];
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

export async function scanCommand(
  cwd: string | undefined,
  opts: ScanOptions,
  logger: Logger,
): Promise<void> {
  const root = resolveCwd(cwd);
  const dir = agentDir(root);

  if (!existsSync(dir)) {
    throw new UserError(`No \`agent/\` directory found. Run \`agentctx init\` first.`);
  }

  // Manifest is required by convention; config is optional.
  await loadManifest(root);
  const config = await loadConfig(root);

  const now = new Date().toISOString();
  const generatorVersion = loadVersion();
  const projectName = path.basename(root) || "project";

  const scanOpts: { now: string; noCache?: boolean; config?: typeof config } = { now };
  if (opts.noCache) scanOpts.noCache = true;
  scanOpts.config = config;
  const result = await scan(root, scanOpts);

  // Source SHA derived from the scan result itself — every file's content sha
  // contributes, so any change to the codebase changes the source sha.
  const sourceSha = sha256(result.repoMap.files.map((f) => f.sha).join(""));

  const repoMapPath = path.join(dir, "repo-map.json");
  const stackPath = path.join(dir, "stack.md");
  const repoMapContent = renderRepoMap(result.repoMap);
  const stackContent = renderStackMd({
    stack: result.stack,
    repoMap: result.repoMap,
    projectName,
    generatorVersion,
    now,
    sourceSha,
  });

  const cmd: ScanCommandResult = { written: [], upToDate: [], wouldChange: [] };

  await reconcile(repoMapPath, repoMapContent, "agent/repo-map.json", opts, cmd, logger);
  await reconcileStack(stackPath, stackContent, "agent/stack.md", opts, cmd, logger);

  if (opts.json) {
    logger.print(
      JSON.stringify(
        {
          ok: cmd.wouldChange.length === 0,
          totalFiles: result.repoMap.summary.totalFiles,
          totalLines: result.repoMap.summary.totalLines,
          languages: result.repoMap.summary.languages,
          stack: result.stack,
          ...cmd,
        },
        null,
        2,
      ),
    );
  } else {
    if (cmd.written.length > 0) {
      logger.success(`Scanned ${result.repoMap.summary.totalFiles} files across ${result.repoMap.summary.languages.length} languages.`);
      for (const p of cmd.written) logger.info(`  + ${p}`);
    }
    if (cmd.upToDate.length > 0) {
      logger.info(`Up to date: ${cmd.upToDate.join(", ")}`);
    }
    if (cmd.wouldChange.length > 0) {
      logger.warn(`Would update: ${cmd.wouldChange.join(", ")}`);
    }
  }

  if (opts.check && cmd.wouldChange.length > 0) {
    throw new DriftError(
      `Scan artifacts are stale (${cmd.wouldChange.join(", ")}). Run \`agentctx scan\`.`,
    );
  }
}

async function reconcile(
  absPath: string,
  newContent: string,
  displayPath: string,
  opts: ScanOptions,
  result: ScanCommandResult,
  logger: Logger,
): Promise<void> {
  const existing = existsSync(absPath) ? await readFile(absPath, "utf8") : null;
  const matches = existing === newContent;

  if (matches) {
    result.upToDate.push(displayPath);
    return;
  }

  if (opts.check) {
    result.wouldChange.push(displayPath);
    return;
  }

  await writeFileLF(absPath, newContent);
  result.written.push(displayPath);
  logger.debug(`wrote ${toPosix(displayPath)}`);
}

/**
 * stack.md carries a per-run timestamp inside its provenance header. Without
 * special-casing, the on-disk content would always mismatch and `--check`
 * would never succeed. We strip the `generated-at` line before comparing.
 */
async function reconcileStack(
  absPath: string,
  newContent: string,
  displayPath: string,
  opts: ScanOptions,
  result: ScanCommandResult,
  logger: Logger,
): Promise<void> {
  const existing = existsSync(absPath) ? await readFile(absPath, "utf8") : null;

  // stack.md is both a memory input (loaded into MemorySet) and a scan output,
  // so its own sha contributes to the source-sha used in its own provenance
  // header. That makes the source-sha unstable across iterations. Strip the
  // ENTIRE provenance block — not just generated-at — so comparison is based
  // only on the human-meaningful body.
  const compare = (s: string): string => stripProvenance(s);

  const matches = existing !== null && compare(existing) === compare(newContent);

  if (matches) {
    result.upToDate.push(displayPath);
    return;
  }

  if (opts.check) {
    result.wouldChange.push(displayPath);
    return;
  }

  await writeFileLF(absPath, newContent);
  result.written.push(displayPath);
  logger.debug(`wrote ${toPosix(displayPath)}`);
}
