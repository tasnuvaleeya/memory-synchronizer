import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { create as tarCreate } from "tar";
import { globby } from "globby";
import { type Logger } from "../core/logger.js";
import { UserError } from "../core/errors.js";
import {
  resolveCwd,
  agentDir,
  ignorePath,
  compareStrings,
  AGENT_DIR,
} from "../core/paths.js";
import { readIgnoreFile } from "../core/ignore.js";

export interface ExportOptions {
  json?: boolean;
}

export async function exportCommand(
  cwd: string | undefined,
  destination: string,
  opts: ExportOptions,
  logger: Logger,
): Promise<void> {
  const root = resolveCwd(cwd);
  const dir = agentDir(root);
  if (!existsSync(dir)) {
    throw new UserError(`No \`agent/\` directory found. Run \`agentsync init\` first.`);
  }

  const ignore = await readIgnoreFile(ignorePath(root));
  const relPaths = (
    await globby(["**/*"], { cwd: dir, dot: true, ignore, onlyFiles: true })
  ).sort(compareStrings);

  if (relPaths.length === 0) {
    throw new UserError(`agent/ has no files to export.`);
  }

  const outPath = path.isAbsolute(destination)
    ? destination
    : path.join(root, destination);
  await mkdir(path.dirname(outPath), { recursive: true });

  // tar entries: place files under "agent/" prefix in the archive
  // so the tarball is portable (extracting in a new repo creates agent/...).
  await tarCreate(
    {
      file: outPath,
      cwd: root,
      gzip: true,
      portable: true,
      // sort entries deterministically
      noMtime: true,
    },
    relPaths.map((rel) => path.join(AGENT_DIR, rel)),
  );

  if (opts.json) {
    logger.print(
      JSON.stringify(
        { ok: true, archive: outPath, fileCount: relPaths.length },
        null,
        2,
      ),
    );
  } else {
    logger.success(
      `Exported ${relPaths.length} file${relPaths.length === 1 ? "" : "s"} → ${outPath}`,
    );
  }
}
