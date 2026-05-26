import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Logger } from "../core/logger.js";
import { InternalError } from "../core/errors.js";

/**
 * Resolve the version from the installed package.json. We walk up from the
 * caller's directory until we find a `package.json` with `name === "@agentsync/cli"`,
 * so a vendored or transient package elsewhere on the path can't mask us.
 */
async function readVersion(): Promise<string> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  let dir = here;
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, "package.json");
    try {
      const raw = await readFile(candidate, "utf8");
      const pkg = JSON.parse(raw) as { name?: string; version?: string };
      if (pkg.name === "@agentsync/cli" && typeof pkg.version === "string") {
        return pkg.version;
      }
    } catch {
      // keep walking
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new InternalError("Unable to resolve agentsync version from package.json");
}

export interface VersionOptions {
  json?: boolean;
}

export async function versionCommand(opts: VersionOptions, logger: Logger): Promise<void> {
  const version = await readVersion();
  if (opts.json) {
    logger.print(JSON.stringify({ version }));
  } else {
    logger.print(version);
  }
}
