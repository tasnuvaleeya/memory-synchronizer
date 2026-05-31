import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, rm, stat, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extract as tarExtract } from "tar";
import { globby } from "globby";
import { simpleGit } from "simple-git";
import { type Logger } from "../core/logger.js";
import { UserError } from "../core/errors.js";
import {
  resolveCwd,
  agentDir,
  AGENT_DIR,
  compareStrings,
  toPosix,
} from "../core/paths.js";

export interface ImportOptions {
  into?: string;
  branch?: string;
  force?: boolean;
  json?: boolean;
}

interface ImportResult {
  source: string;
  copied: string[];
  skipped: string[];
}

const GIT_URL_RE = /^(https?:\/\/|git@|ssh:\/\/|git:\/\/).+/i;

export async function importCommand(
  cwd: string | undefined,
  source: string,
  opts: ImportOptions,
  logger: Logger,
): Promise<void> {
  const root = resolveCwd(cwd);
  const dest = opts.into ? path.resolve(root, opts.into) : agentDir(root);

  if (existsSync(dest)) {
    const entries = await readdir(dest);
    if (entries.length > 0 && !opts.force) {
      throw new UserError(
        `Destination ${toPosix(path.relative(root, dest)) || dest} is not empty. Use --force to overwrite.`,
      );
    }
  }

  // Tarball
  if (source.endsWith(".tar.gz") || source.endsWith(".tgz")) {
    await importTarball(source, root, dest);
  } else if (GIT_URL_RE.test(source)) {
    await importGit(source, opts.branch, dest, root);
  } else {
    // Local path
    await importLocal(source, dest, root);
  }

  const copied = (
    await globby(["**/*"], { cwd: dest, dot: true, onlyFiles: true })
  )
    .map(toPosix)
    .sort(compareStrings);

  const result: ImportResult = { source, copied, skipped: [] };

  if (opts.json) {
    logger.print(JSON.stringify({ ok: true, ...result }, null, 2));
  } else {
    logger.success(
      `Imported ${copied.length} file${copied.length === 1 ? "" : "s"} from ${source} → ${toPosix(path.relative(root, dest)) || AGENT_DIR}`,
    );
  }
}

async function importTarball(source: string, root: string, dest: string): Promise<void> {
  const absSrc = path.isAbsolute(source) ? source : path.join(root, source);
  if (!existsSync(absSrc)) throw new UserError(`Tarball not found: ${absSrc}`);

  // Extract to a temp dir first, then move into place. This avoids partial
  // writes on tarball error.
  const stage = await mkdtemp(path.join(tmpdir(), "agentctx-import-"));
  try {
    await tarExtract({ file: absSrc, cwd: stage });

    // Locate the agent/ directory inside the tarball, if any
    const stagedAgent = path.join(stage, AGENT_DIR);
    const src = existsSync(stagedAgent) ? stagedAgent : stage;
    await copyDir(src, dest);
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

async function importGit(
  source: string,
  branch: string | undefined,
  dest: string,
  _root: string,
): Promise<void> {
  const stage = await mkdtemp(path.join(tmpdir(), "agentctx-clone-"));
  try {
    const git = simpleGit();
    const cloneArgs: string[] = ["--depth", "1"];
    if (branch) cloneArgs.push("--branch", branch);
    await git.clone(source, stage, cloneArgs);

    const clonedAgent = path.join(stage, AGENT_DIR);
    if (!existsSync(clonedAgent)) {
      throw new UserError(
        `Cloned repo ${source} has no ${AGENT_DIR}/ directory at its root.`,
      );
    }
    await copyDir(clonedAgent, dest);
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

async function importLocal(source: string, dest: string, root: string): Promise<void> {
  const absSrc = path.isAbsolute(source) ? source : path.join(root, source);
  if (!existsSync(absSrc)) {
    throw new UserError(`Source path not found: ${absSrc}`);
  }
  const s = await stat(absSrc);
  if (!s.isDirectory()) {
    throw new UserError(`Source must be a directory, a .tar.gz file, or a git URL.`);
  }
  // If the source directory contains an `agent/` subdir, prefer that.
  const inner = path.join(absSrc, AGENT_DIR);
  const src = existsSync(inner) ? inner : absSrc;
  await copyDir(src, dest);
}

async function copyDir(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true });
  const entries = await globby(["**/*"], { cwd: src, dot: true, onlyFiles: true });
  for (const rel of entries) {
    const srcFile = path.join(src, rel);
    const destFile = path.join(dest, rel);
    await mkdir(path.dirname(destFile), { recursive: true });
    const data = await readFile(srcFile);
    await writeFile(destFile, data);
  }
}
