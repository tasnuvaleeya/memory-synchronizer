#!/usr/bin/env node
import { Command, Option } from "commander";
import pc from "picocolors";
import { Logger } from "../core/logger.js";
import { AgentsyncError } from "../core/errors.js";

// `Command` is used both as a value (e.g. `new Command()`) and as a parameter
// type in handler signatures, so we import it as a value.
import { initCommand } from "./init.js";
import { validateCommand } from "./validate.js";
import { showCommand } from "./show.js";
import { versionCommand } from "./version.js";
import { syncCommand } from "./sync.js";
import { diffCommand } from "./diff.js";
import { installHookCommand, type HookType } from "./installHook.js";
import { scanCommand } from "./scan.js";
import { lintCommand } from "./lint.js";
import { statsCommand } from "./stats.js";
import { exportCommand } from "./export.js";
import { importCommand } from "./import.js";

interface GlobalOpts {
  cwd?: string;
  quiet?: boolean;
  verbose?: boolean;
  color?: boolean;
}

function makeLogger(global: GlobalOpts): Logger {
  return new Logger({
    ...(global.quiet !== undefined && { quiet: global.quiet }),
    ...(global.verbose !== undefined && { verbose: global.verbose }),
    ...(global.color !== undefined && { color: global.color }),
  });
}

export function buildProgram(): Command {
  const program = new Command();

  program
    .name("agentsync")
    .description(
      "Shared, repo-local memory layer that synchronizes context across AI coding agents.",
    )
    .option("--cwd <path>", "operate as if run from this directory")
    .option("--quiet", "suppress non-error output")
    .option("--verbose", "verbose diagnostics")
    .addOption(new Option("--no-color", "disable ANSI color"))
    .showHelpAfterError();

  program
    .command("init")
    .description("scaffold a fresh /agent directory with starter templates")
    .option("--template <name>", "template name", "starter")
    .option("--targets <list>", "comma-separated adapter targets")
    .option("--yes", "merge into an existing /agent without erroring")
    .option("--json", "machine-readable output")
    .action(async (cmdOpts, cmd: Command) => {
      const global = cmd.optsWithGlobals<GlobalOpts>();
      const logger = makeLogger(global);
      await runCommand(() => initCommand(global.cwd, cmdOpts, logger), logger, global);
    });

  program
    .command("validate")
    .description("validate manifest, frontmatter, and intra-repo links")
    .option("--strict", "treat warnings as errors")
    .option("--json", "machine-readable output")
    .action(async (cmdOpts, cmd: Command) => {
      const global = cmd.optsWithGlobals<GlobalOpts>();
      const logger = makeLogger(global);
      await runCommand(() => validateCommand(global.cwd, cmdOpts, logger), logger, global);
    });

  program
    .command("show <file>")
    .description("render a memory file's frontmatter and body")
    .option("--json", "machine-readable output")
    .action(async (file: string, cmdOpts, cmd: Command) => {
      const global = cmd.optsWithGlobals<GlobalOpts>();
      const logger = makeLogger(global);
      await runCommand(() => showCommand(global.cwd, file, cmdOpts, logger), logger, global);
    });

  program
    .command("version")
    .description("print the installed agentsync version")
    .option("--json", "machine-readable output")
    .action(async (cmdOpts, cmd: Command) => {
      const global = cmd.optsWithGlobals<GlobalOpts>();
      const logger = makeLogger(global);
      await runCommand(() => versionCommand(cmdOpts, logger), logger, global);
    });

  program
    .command("sync")
    .description("generate per-agent files from /agent source files")
    .option("--check", "exit with code 2 if any files would change (CI mode)")
    .option("--adapter <names...>", "limit sync to specific adapter(s)")
    .option("--dry-run", "show what would be written without writing")
    .option("--force", "overwrite files even if manually edited")
    .option("--json", "machine-readable output")
    .action(async (cmdOpts, cmd: Command) => {
      const global = cmd.optsWithGlobals<GlobalOpts>();
      const logger = makeLogger(global);
      await runCommand(() => syncCommand(global.cwd, cmdOpts, logger), logger, global);
    });

  program
    .command("diff [adapter]")
    .description("preview what agentsync sync would change")
    .option("--json", "machine-readable output")
    .action(async (adapterArg: string | undefined, cmdOpts, cmd: Command) => {
      const global = cmd.optsWithGlobals<GlobalOpts>();
      const logger = makeLogger(global);
      await runCommand(
        () => diffCommand(global.cwd, adapterArg, cmdOpts, logger),
        logger,
        global,
      );
    });

  program
    .command("scan")
    .description("walk the repo and regenerate agent/repo-map.json + agent/stack.md")
    .option("--check", "exit with code 2 if scan artifacts would change (CI mode)")
    .option("--incremental", "reserved for future watch mode (no-op in Phase 1)")
    .option("--no-cache", "ignore the on-disk scan cache")
    .option("--json", "machine-readable output")
    .action(async (cmdOpts, cmd: Command) => {
      const global = cmd.optsWithGlobals<GlobalOpts>();
      const logger = makeLogger(global);
      await runCommand(() => scanCommand(global.cwd, cmdOpts, logger), logger, global);
    });

  program
    .command("lint")
    .description("lint memory files (heading hierarchy, banned phrases, freshness, etc.)")
    .option("--fix", "apply safe auto-fixes where available")
    .option("--policy <path>", "explicit policy file (defaults to agentsync.policy.yaml)")
    .option("--json", "machine-readable output")
    .action(async (cmdOpts, cmd: Command) => {
      const global = cmd.optsWithGlobals<GlobalOpts>();
      const logger = makeLogger(global);
      await runCommand(() => lintCommand(global.cwd, cmdOpts, logger), logger, global);
    });

  program
    .command("stats")
    .description("show per-adapter token counts, file counts, and drift status")
    .option("--json", "machine-readable output")
    .action(async (cmdOpts, cmd: Command) => {
      const global = cmd.optsWithGlobals<GlobalOpts>();
      const logger = makeLogger(global);
      await runCommand(() => statsCommand(global.cwd, cmdOpts, logger), logger, global);
    });

  program
    .command("export <path>")
    .description("bundle agent/ into a portable .tar.gz")
    .option("--json", "machine-readable output")
    .action(async (destPath: string, cmdOpts, cmd: Command) => {
      const global = cmd.optsWithGlobals<GlobalOpts>();
      const logger = makeLogger(global);
      await runCommand(
        () => exportCommand(global.cwd, destPath, cmdOpts, logger),
        logger,
        global,
      );
    });

  program
    .command("import <source>")
    .description("pull a starter agent/ from a local path, .tar.gz, or git URL")
    .option("--into <path>", "destination directory (default: agent/)")
    .option("--branch <ref>", "branch or tag to clone (git sources only)")
    .option("--force", "overwrite an existing non-empty destination")
    .option("--json", "machine-readable output")
    .action(async (source: string, cmdOpts, cmd: Command) => {
      const global = cmd.optsWithGlobals<GlobalOpts>();
      const logger = makeLogger(global);
      await runCommand(
        () => importCommand(global.cwd, source, cmdOpts, logger),
        logger,
        global,
      );
    });

  program
    .command("install-hook [type]")
    .description("install a git pre-commit hook that runs agentsync sync --check")
    .option("--json", "machine-readable output")
    .action(async (hookType: string | undefined, cmdOpts, cmd: Command) => {
      const global = cmd.optsWithGlobals<GlobalOpts>();
      const logger = makeLogger(global);
      const resolvedType: HookType =
        hookType === "husky" ? "husky" : "native";
      await runCommand(
        () => installHookCommand(global.cwd, resolvedType, cmdOpts, logger),
        logger,
        global,
      );
    });

  return program;
}

async function runCommand(
  fn: () => Promise<void>,
  logger: Logger,
  global: GlobalOpts,
): Promise<void> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof AgentsyncError) {
      logger.error(err.message);
      process.exit(err.exitCode);
    }
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Unexpected error: ${message}`);
    if (global.verbose && err instanceof Error && err.stack) {
      process.stderr.write(pc.dim(err.stack) + "\n");
    }
    process.exit(3);
  }
}

// This module is only loaded as the CLI entry (`bin/agentsync`); the library
// surface lives at `src/index.ts` and does not import this file. So we always
// parse argv when this file is executed.
buildProgram()
  .parseAsync(process.argv)
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Fatal: ${message}\n`);
    process.exit(3);
  });
