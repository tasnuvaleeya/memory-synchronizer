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

interface GlobalOpts {
  cwd?: string;
  quiet?: boolean;
  verbose?: boolean;
  color?: boolean;
}

function makeLogger(global: GlobalOpts): Logger {
  return new Logger({
    quiet: global.quiet,
    verbose: global.verbose,
    color: global.color,
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
