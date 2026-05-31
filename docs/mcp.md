# MCP integration

`agentctx` ships a built-in [Model Context Protocol](https://modelcontextprotocol.io) server that exposes your repo's `agent/` directory as MCP resources. Any MCP-aware client — Claude Desktop, Claude Code, custom agents — can list and read memory files, adapter outputs, and scan artifacts.

## Run

```sh
agentctx mcp
```

This starts a stdio-transport server. It exits when the client disconnects.

The command does **not** run on its own — it's meant to be launched by an MCP client. See the wiring instructions below.

## Resources exposed

| URI | MIME | Source |
|---|---|---|
| `agentctx://manifest` | `application/yaml` | `agent/manifest.yaml` |
| `agentctx://memory/list` | `application/json` | array of `{path, frontmatter, sha}` for every memory file |
| `agentctx://memory/<path>` | `text/markdown` | individual memory file with frontmatter (e.g. `agent/coding-rules.md`) |
| `agentctx://adapters/<name>` | `text/markdown` | rendered output of a built-in adapter (`claude`, `cursor`, `cline`, `windsurf`, `copilot`, `agents-md`) |
| `agentctx://scan/repo-map` | `application/json` | `agent/repo-map.json` (only listed if present) |
| `agentctx://scan/stack` | `text/markdown` | `agent/stack.md` (only listed if present) |

The server is **read-only**. There are no MCP tools (write actions) — the CLI is the supported write surface.

## Wire into Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "agentctx": {
      "command": "npx",
      "args": ["-y", "agentctx", "mcp"],
      "cwd": "/absolute/path/to/your/repo"
    }
  }
}
```

Restart Claude Desktop. The `agentctx` server's resources will appear in the conversation under the attachment / resource picker.

## Wire into Claude Code

Add to `.mcp.json` at your repo root:

```json
{
  "mcpServers": {
    "agentctx": {
      "command": "agentctx",
      "args": ["mcp"]
    }
  }
}
```

Claude Code picks this up automatically. The `cwd` for the spawned process is your repo root, so paths resolve correctly without configuration.

## Wire into a custom MCP client

```ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "agentctx",
  args: ["mcp"],
  cwd: "/path/to/repo",
});

const client = new Client(
  { name: "my-client", version: "1.0.0" },
  { capabilities: {} },
);
await client.connect(transport);

const { resources } = await client.listResources();
const codingRules = await client.readResource({
  uri: "agentctx://memory/coding-rules.md",
});
```

## Versioning

The MCP server tracks a specific MCP spec version pinned in `package.json`. Breaking changes in the spec will be called out in the changelog before the bump.
