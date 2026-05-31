import path from "node:path";
import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { type Logger, colors } from "../core/logger.js";
import { UserError } from "../core/errors.js";
import { resolveCwd, agentDir, toPosix } from "../core/paths.js";
import { loadMemorySet } from "../core/load.js";
import { loadPolicy } from "../core/policy.js";
import { runLinter, type LintFinding } from "../linter/engine.js";
import { BUILTIN_RULES } from "../linter/rules/index.js";

export interface LintOptions {
  fix?: boolean;
  json?: boolean;
  policy?: string;
}

export async function lintCommand(
  cwd: string | undefined,
  opts: LintOptions,
  logger: Logger,
): Promise<void> {
  const root = resolveCwd(cwd);
  const dir = agentDir(root);
  if (!existsSync(dir)) {
    throw new UserError(`No \`agent/\` directory found. Run \`agentctx init\` first.`);
  }

  const [memory, policy] = await Promise.all([
    loadMemorySet(root),
    loadPolicy(root, opts.policy),
  ]);

  // mtimes for the freshness rule
  const mtimes = new Map<string, number>();
  for (const f of memory.files) {
    try {
      const s = await stat(path.join(dir, f.path));
      mtimes.set(f.path, s.mtimeMs);
    } catch {
      mtimes.set(f.path, Date.now());
    }
  }

  const findings = runLinter(memory.files, {
    rules: BUILTIN_RULES,
    policy,
    mtimes,
  });

  const errors = findings.filter((f) => f.level === "error");
  const warnings = findings.filter((f) => f.level === "warn");

  if (opts.json) {
    logger.print(
      JSON.stringify(
        {
          ok: errors.length === 0,
          fileCount: memory.files.length,
          errors,
          warnings,
        },
        null,
        2,
      ),
    );
  } else {
    for (const f of findings) {
      printFinding(f, logger);
    }
    if (findings.length === 0) {
      logger.success(`Lint clean across ${memory.files.length} memory file${memory.files.length === 1 ? "" : "s"}.`);
    } else {
      logger.info(
        `${errors.length} error${errors.length === 1 ? "" : "s"}, ${warnings.length} warning${warnings.length === 1 ? "" : "s"} across ${memory.files.length} file${memory.files.length === 1 ? "" : "s"}.`,
      );
    }
  }

  if (errors.length > 0) {
    throw new UserError("Lint failed.");
  }
}

function printFinding(f: LintFinding, logger: Logger): void {
  const label = f.level === "error" ? colors.red("error") : colors.yellow("warn");
  const loc = `${colors.dim(toPosix(f.path))}:${f.line}`;
  logger.print(`${label} ${loc} [${colors.dim(f.ruleId)}] ${f.message}`);
}
