import { existsSync } from "node:fs";
import path from "node:path";
import { globby } from "globby";
import { type Logger, colors } from "../core/logger.js";
import { UserError, AgentsyncError } from "../core/errors.js";
import {
  agentDir,
  compareStrings,
  ignorePath,
  readFileUtf8,
  resolveCwd,
  toPosix,
} from "../core/paths.js";
import { loadManifest } from "../core/load.js";
import { parseFrontmatter } from "../core/frontmatter.js";
import { readIgnoreFile } from "../core/ignore.js";

export interface ValidateOptions {
  strict?: boolean;
  json?: boolean;
}

interface Finding {
  level: "error" | "warning";
  path: string;
  message: string;
}

const LINK_RE = /\[[^\]]*\]\((?!https?:|mailto:|#)([^)\s]+)\)/g;

export async function validateCommand(
  cwd: string | undefined,
  opts: ValidateOptions,
  logger: Logger,
): Promise<void> {
  const root = resolveCwd(cwd);
  const dir = agentDir(root);

  if (!existsSync(dir)) {
    throw new UserError(
      `No \`${toPosix(path.relative(root, dir)) || "agent"}\` directory found. Run \`agentsync init\` first.`,
    );
  }

  const findings: Finding[] = [];
  const manifest = await loadManifest(root);

  const ignore = await readIgnoreFile(ignorePath(root));
  const discoveredMd = (
    await globby(["**/*.md"], { cwd: dir, dot: false, ignore })
  )
    .map(toPosix)
    .sort(compareStrings);

  const declaredPaths = new Set(manifest.files.map((f) => toPosix(f.path)));
  const discoveredSet = new Set(discoveredMd);

  // 1. Validate frontmatter for every discovered markdown file.
  let fileCount = 0;
  for (const rel of discoveredMd) {
    const abs = path.join(dir, rel);
    const raw = await readFileUtf8(abs);
    try {
      const { body } = parseFrontmatter(rel, raw);
      checkLinks(rel, body, dir, findings);
      fileCount += 1;
    } catch (err) {
      if (err instanceof AgentsyncError) {
        findings.push({ level: "error", path: rel, message: err.message });
      } else {
        throw err;
      }
    }
  }

  // 2. Manifest entries must exist on disk (warning for generated, error otherwise).
  for (const entry of manifest.files) {
    const rel = toPosix(entry.path);
    const abs = path.join(dir, rel);
    if (!existsSync(abs)) {
      const level: Finding["level"] = entry.source === "generated" ? "warning" : "error";
      findings.push({
        level,
        path: rel,
        message: `declared in manifest but not present on disk (source: ${entry.source})`,
      });
    }
  }

  // 3. On-disk markdown files should be listed in the manifest (warning).
  for (const rel of discoveredMd) {
    if (!declaredPaths.has(rel)) {
      findings.push({
        level: "warning",
        path: rel,
        message: "present on disk but not listed in manifest.files",
      });
    }
  }

  // 4. Suppress "discovered" warnings about workflow files when the manifest
  //    declares the whole directory (future: support glob entries).
  //    Currently we treat every file individually — no special-casing.
  void discoveredSet;

  const errors = findings.filter((f) => f.level === "error");
  const warnings = findings.filter((f) => f.level === "warning");

  if (opts.json) {
    logger.print(
      JSON.stringify(
        {
          ok: errors.length === 0 && (!opts.strict || warnings.length === 0),
          fileCount,
          errors,
          warnings,
        },
        null,
        2,
      ),
    );
  } else {
    for (const f of findings) {
      const label = f.level === "error" ? colors.red("error") : colors.yellow("warn");
      logger.print(`${label} ${colors.dim(f.path)}: ${f.message}`);
    }
    if (errors.length === 0 && warnings.length === 0) {
      logger.success(`Validated ${fileCount} memory file${fileCount === 1 ? "" : "s"}.`);
    } else {
      logger.info(
        `${errors.length} error${errors.length === 1 ? "" : "s"}, ${warnings.length} warning${warnings.length === 1 ? "" : "s"} across ${fileCount} file${fileCount === 1 ? "" : "s"}.`,
      );
    }
  }

  if (errors.length > 0) {
    throw new UserError("Validation failed.");
  }
  if (opts.strict && warnings.length > 0) {
    // Strict mode escalates warnings; reuse UserError for the exit-code mapping.
    throw new UserError("Validation produced warnings (strict mode).");
  }
}

function checkLinks(file: string, body: string, dir: string, findings: Finding[]): void {
  const fileDir = path.dirname(file);
  LINK_RE.lastIndex = 0;
  for (const match of body.matchAll(LINK_RE)) {
    const target = match[1];
    if (!target) continue;
    // Drop URL fragments and query strings for filesystem lookup.
    const cleaned = target.split("#")[0]?.split("?")[0] ?? "";
    if (cleaned === "") continue;
    const resolved = path.join(dir, fileDir, cleaned);
    if (!existsSync(resolved)) {
      findings.push({
        level: "warning",
        path: file,
        message: `broken link → ${target}`,
      });
    }
  }
}
