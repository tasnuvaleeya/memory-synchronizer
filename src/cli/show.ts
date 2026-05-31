import { existsSync } from "node:fs";
import path from "node:path";
import { type Logger, colors } from "../core/logger.js";
import { UserError } from "../core/errors.js";
import { agentDir, readFileUtf8, resolveCwd, toPosix } from "../core/paths.js";
import { parseFrontmatter } from "../core/frontmatter.js";

export interface ShowOptions {
  json?: boolean;
}

export async function showCommand(
  cwd: string | undefined,
  filename: string,
  opts: ShowOptions,
  logger: Logger,
): Promise<void> {
  const root = resolveCwd(cwd);
  const resolved = resolveTargetPath(root, filename);
  if (!resolved) {
    throw new UserError(`File not found: ${filename}`);
  }

  const raw = await readFileUtf8(resolved);
  const { frontmatter, body } = parseFrontmatter(toPosix(path.relative(root, resolved)), raw);

  if (opts.json) {
    logger.print(
      JSON.stringify(
        {
          path: toPosix(path.relative(root, resolved)),
          frontmatter,
          body,
        },
        null,
        2,
      ),
    );
    return;
  }

  logger.print(colors.bold(colors.cyan(toPosix(path.relative(root, resolved)))));
  logger.print(colors.dim("─".repeat(60)));
  for (const [k, v] of Object.entries(frontmatter)) {
    logger.print(`${colors.dim(k.padEnd(13))} ${formatValue(v)}`);
  }
  logger.print(colors.dim("─".repeat(60)));
  logger.print(body.trimEnd());
}

function resolveTargetPath(root: string, filename: string): string | null {
  const direct = path.resolve(root, filename);
  if (existsSync(direct)) return direct;
  // Allow shorthand: `agentctx show coding-rules.md` should find agent/coding-rules.md
  const inAgent = path.join(agentDir(root), filename);
  if (existsSync(inAgent)) return inAgent;
  return null;
}

function formatValue(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map((x) => String(x)).join(", ")}]`;
  return String(v);
}
