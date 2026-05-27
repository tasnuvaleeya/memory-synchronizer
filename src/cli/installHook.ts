import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { type Logger } from "../core/logger.js";
import { UserError } from "../core/errors.js";
import { resolveCwd } from "../core/paths.js";
import { isGitRepo } from "../core/git.js";

export type HookType = "native" | "husky";

export interface InstallHookOptions {
  json?: boolean;
}

const NATIVE_HOOK_SCRIPT = `#!/bin/sh
# Installed by agentsync install-hook
agentsync sync --check
`;

const HUSKY_HOOK_SCRIPT = `agentsync sync --check
`;

export async function installHookCommand(
  cwd: string | undefined,
  hookType: HookType,
  opts: InstallHookOptions,
  logger: Logger,
): Promise<void> {
  const root = resolveCwd(cwd);

  if (!(await isGitRepo(root))) {
    throw new UserError(`Not a git repository: ${root}. Initialize git first.`);
  }

  if (hookType === "husky") {
    await installHuskyHook(root, opts, logger);
  } else {
    await installNativeHook(root, opts, logger);
  }
}

async function installNativeHook(
  root: string,
  opts: InstallHookOptions,
  logger: Logger,
): Promise<void> {
  const hooksDir = path.join(root, ".git", "hooks");
  const hookPath = path.join(hooksDir, "pre-commit");

  await mkdir(hooksDir, { recursive: true });

  if (existsSync(hookPath)) {
    const existing = await readFile(hookPath, "utf8");
    if (existing.includes("agentsync sync --check")) {
      if (opts.json) {
        logger.print(JSON.stringify({ ok: true, hookPath, action: "already-installed" }, null, 2));
      } else {
        logger.info(`Hook already installed at ${hookPath}`);
      }
      return;
    }
    // Append to existing hook
    const updated = existing.trimEnd() + "\n\n" + NATIVE_HOOK_SCRIPT;
    await writeFile(hookPath, updated, "utf8");
  } else {
    await writeFile(hookPath, NATIVE_HOOK_SCRIPT, "utf8");
  }

  await chmod(hookPath, 0o755);

  if (opts.json) {
    logger.print(JSON.stringify({ ok: true, hookPath, action: "installed" }, null, 2));
  } else {
    logger.success(`Installed native pre-commit hook at ${hookPath}`);
  }
}

async function installHuskyHook(
  root: string,
  opts: InstallHookOptions,
  logger: Logger,
): Promise<void> {
  const huskyDir = path.join(root, ".husky");
  const hookPath = path.join(huskyDir, "pre-commit");

  if (!existsSync(huskyDir)) {
    throw new UserError(
      `Husky is not initialized. Run \`npx husky init\` first, then re-run \`agentsync install-hook husky\`.`,
    );
  }

  if (existsSync(hookPath)) {
    const existing = await readFile(hookPath, "utf8");
    if (existing.includes("agentsync sync --check")) {
      if (opts.json) {
        logger.print(JSON.stringify({ ok: true, hookPath, action: "already-installed" }, null, 2));
      } else {
        logger.info(`Hook already installed at ${hookPath}`);
      }
      return;
    }
    const updated = existing.trimEnd() + "\n" + HUSKY_HOOK_SCRIPT;
    await writeFile(hookPath, updated, "utf8");
  } else {
    await writeFile(hookPath, `#!/bin/sh\n${HUSKY_HOOK_SCRIPT}`, "utf8");
    await chmod(hookPath, 0o755);
  }

  if (opts.json) {
    logger.print(JSON.stringify({ ok: true, hookPath, action: "installed" }, null, 2));
  } else {
    logger.success(`Installed Husky pre-commit hook at ${hookPath}`);
    logger.info(`Make sure \`agentsync\` is in your PATH or use \`npx agentsync sync --check\`.`);
  }
}
