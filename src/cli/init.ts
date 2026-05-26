import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { globby } from "globby";
import { type Logger } from "../core/logger.js";
import { UserError } from "../core/errors.js";
import {
  AGENT_DIR,
  CONFIG_DIR,
  CONFIG_FILENAME,
  agentDir,
  compareStrings,
  resolveCwd,
  templatesDir,
  toPosix,
  writeFileLF,
} from "../core/paths.js";

const STARTER_NAME = "starter";

export interface InitOptions {
  template?: string;
  targets?: string;
  yes?: boolean;
  json?: boolean;
}

interface InitResult {
  created: string[];
  skipped: string[];
  agentDir: string;
}

export async function initCommand(
  cwd: string | undefined,
  opts: InitOptions,
  logger: Logger,
): Promise<void> {
  const root = resolveCwd(cwd);
  const dest = agentDir(root);
  const template = opts.template ?? STARTER_NAME;
  const srcDir = path.join(templatesDir(import.meta.url), template);

  if (!existsSync(srcDir)) {
    throw new UserError(`Unknown template: ${template}`);
  }

  if (existsSync(dest)) {
    const entries = await readdir(dest);
    if (entries.length > 0 && !opts.yes) {
      throw new UserError(
        `${toPosix(path.relative(root, dest))} already exists and is not empty. Re-run with --yes to merge without overwriting.`,
      );
    }
  }

  const projectName = await resolveProjectName(root);
  const targets = parseTargets(opts.targets);

  // Discover every file under the template, including dotfiles.
  const relPaths = await globby(["**/*"], { cwd: srcDir, dot: true });
  relPaths.sort(compareStrings);

  const result: InitResult = { created: [], skipped: [], agentDir: dest };

  for (const rel of relPaths) {
    const srcFile = path.join(srcDir, rel);
    const destFile = path.join(dest, rel);
    if (existsSync(destFile)) {
      result.skipped.push(toPosix(rel));
      continue;
    }
    const raw = await readFile(srcFile, "utf8");
    const rendered = renderTemplate(raw, { projectName, targets });
    await writeFileLF(destFile, rendered);
    result.created.push(toPosix(rel));
  }

  await writeDefaultConfig(root);

  if (opts.json) {
    logger.print(
      JSON.stringify(
        {
          ok: true,
          agentDir: toPosix(path.relative(root, dest)) || AGENT_DIR,
          created: result.created,
          skipped: result.skipped,
        },
        null,
        2,
      ),
    );
    return;
  }

  logger.success(
    `Initialized ${result.created.length} file${result.created.length === 1 ? "" : "s"} under ${AGENT_DIR}/`,
  );
  for (const p of result.created) {
    logger.info(`  + ${AGENT_DIR}/${p}`);
  }
  for (const p of result.skipped) {
    logger.warn(`  ~ ${AGENT_DIR}/${p} (skipped, already exists)`);
  }
  logger.info("");
  logger.info("Next: edit `agent/coding-rules.md`, then run `agentsync validate`.");
}

function parseTargets(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return list.length > 0 ? list : undefined;
}

async function resolveProjectName(root: string): Promise<string> {
  const pkgPath = path.join(root, "package.json");
  try {
    const raw = await readFile(pkgPath, "utf8");
    const pkg = JSON.parse(raw) as { name?: string };
    if (typeof pkg.name === "string" && pkg.name.length > 0) {
      // Drop scope prefix for friendlier default (`@org/foo` → `foo`).
      const trimmed = pkg.name.startsWith("@")
        ? pkg.name.split("/").pop() ?? pkg.name
        : pkg.name;
      return trimmed;
    }
  } catch {
    // fall through to dir basename
  }
  return path.basename(root);
}

interface RenderVars {
  projectName: string;
  targets: string[] | undefined;
}

function renderTemplate(raw: string, vars: RenderVars): string {
  let out = raw.replace(/\{\{\s*projectName\s*\}\}/g, vars.projectName);
  if (vars.targets) {
    const yamlList = vars.targets.map((t) => `  - ${t}`).join("\n");
    out = out.replace(/\{\{\s*targetsList\s*\}\}/g, yamlList);
  } else {
    // Default targets are baked into the template; leave the marker alone.
    out = out.replace(/\{\{\s*targetsList\s*\}\}/g, defaultTargetsYaml());
  }
  return out;
}

function defaultTargetsYaml(): string {
  return ["claude", "agents-md", "cursor", "cline", "windsurf", "copilot"]
    .map((t) => `  - ${t}`)
    .join("\n");
}

async function writeDefaultConfig(root: string): Promise<void> {
  const dest = path.join(root, CONFIG_DIR, CONFIG_FILENAME);
  if (existsSync(dest)) return;
  const body = [
    "# agentsync local config",
    "# See https://github.com/tasnuva-aif/memory-synchronizer for schema docs.",
    "defaultAdapters:",
    "  - claude",
    "  - agents-md",
    "tokenBudgets: {}",
    "plugins:",
    "  adapters: []",
    "  scanners: []",
    "  lintRules: []",
    "",
  ].join("\n");
  await writeFileLF(dest, body);
}
