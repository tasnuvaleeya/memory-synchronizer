import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type Logger } from "../core/logger.js";
import { resolveCwd } from "../core/paths.js";
import { runStdioServer } from "../mcp/server.js";

export interface McpOptions {
  json?: boolean;
}

function loadVersion(): string {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const pkgPath = path.resolve(here, "..", "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
    return pkg.version;
  } catch {
    return "0.0.0";
  }
}

export async function mcpCommand(
  cwd: string | undefined,
  _opts: McpOptions,
  logger: Logger,
): Promise<void> {
  const root = resolveCwd(cwd);
  const serverVersion = loadVersion();

  logger.debug(`Starting MCP server on stdio for ${root}`);

  // Returns when the transport closes (typically when the client disconnects).
  await runStdioServer({ cwd: root, serverVersion });
}
