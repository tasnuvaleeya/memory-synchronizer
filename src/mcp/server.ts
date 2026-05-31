import path from "node:path";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  type Resource,
  type ReadResourceResult,
} from "@modelcontextprotocol/sdk/types.js";
import { loadManifest, loadMemorySet, loadConfig } from "../core/load.js";
import { agentDir, manifestPath } from "../core/paths.js";
import { resolveAdapters, listBuiltInAdapters } from "../adapters/registry.js";
import type { RenderContext } from "@agentctx/adapter-sdk";

interface ServerOpts {
  cwd: string;
  serverVersion: string;
}

const MANIFEST_URI = "agentctx://manifest";
const MEMORY_LIST_URI = "agentctx://memory/list";
const SCAN_REPO_MAP_URI = "agentctx://scan/repo-map";
const SCAN_STACK_URI = "agentctx://scan/stack";

export function buildServer(opts: ServerOpts): Server {
  const { cwd, serverVersion } = opts;

  const server = new Server(
    { name: "agentctx", version: serverVersion },
    { capabilities: { resources: {} } },
  );

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const resources: Resource[] = [];
    const dir = agentDir(cwd);
    if (!existsSync(dir)) return { resources };

    if (existsSync(manifestPath(cwd))) {
      resources.push({
        uri: MANIFEST_URI,
        name: "manifest",
        description: "agent/manifest.yaml",
        mimeType: "application/yaml",
      });
    }

    let memory;
    try {
      memory = await loadMemorySet(cwd);
    } catch {
      memory = null;
    }

    if (memory) {
      resources.push({
        uri: MEMORY_LIST_URI,
        name: "memory/list",
        description: "List of all memory files with frontmatter.",
        mimeType: "application/json",
      });
      for (const f of memory.files) {
        resources.push({
          uri: `agentctx://memory/${f.path}`,
          name: `memory/${f.path}`,
          description: f.frontmatter.description,
          mimeType: "text/markdown",
        });
      }
    }

    // Adapter outputs
    try {
      const manifest = await loadManifest(cwd);
      const config = await loadConfig(cwd);
      const manifestTargets = new Set(manifest.targets);
      const configDefaults = new Set(config.defaultAdapters);
      const adapterNames = listBuiltInAdapters().filter(
        (n) => manifestTargets.has(n) || configDefaults.has(n),
      );
      for (const name of adapterNames) {
        resources.push({
          uri: `agentctx://adapters/${name}`,
          name: `adapters/${name}`,
          description: `Rendered output of the ${name} adapter.`,
          mimeType: "text/markdown",
        });
      }
    } catch {
      // Manifest missing or invalid — skip adapter resources.
    }

    if (existsSync(path.join(dir, "repo-map.json"))) {
      resources.push({
        uri: SCAN_REPO_MAP_URI,
        name: "scan/repo-map",
        description: "agent/repo-map.json",
        mimeType: "application/json",
      });
    }
    if (existsSync(path.join(dir, "stack.md"))) {
      resources.push({
        uri: SCAN_STACK_URI,
        name: "scan/stack",
        description: "agent/stack.md",
        mimeType: "text/markdown",
      });
    }

    return { resources };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (req): Promise<ReadResourceResult> => {
    const uri = req.params.uri;

    if (uri === MANIFEST_URI) {
      const text = await readFile(manifestPath(cwd), "utf8");
      return { contents: [{ uri, mimeType: "application/yaml", text }] };
    }

    if (uri === MEMORY_LIST_URI) {
      const memory = await loadMemorySet(cwd);
      const summary = memory.files.map((f) => ({
        path: f.path,
        frontmatter: f.frontmatter,
        sha: f.sha,
      }));
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(summary, null, 2),
          },
        ],
      };
    }

    const memMatch = /^agentctx:\/\/memory\/(.+)$/.exec(uri);
    if (memMatch) {
      const rel = memMatch[1]!;
      const memory = await loadMemorySet(cwd);
      const file = memory.files.find((f) => f.path === rel);
      if (!file) throw new Error(`Memory file not found: ${rel}`);
      const abs = path.join(agentDir(cwd), file.path);
      const text = await readFile(abs, "utf8");
      return { contents: [{ uri, mimeType: "text/markdown", text }] };
    }

    const adapterMatch = /^agentctx:\/\/adapters\/(.+)$/.exec(uri);
    if (adapterMatch) {
      const name = adapterMatch[1]!;
      const [manifest, memory, config] = await Promise.all([
        loadManifest(cwd),
        loadMemorySet(cwd),
        loadConfig(cwd),
      ]);
      const [adapter] = await resolveAdapters([name]);
      if (!adapter) throw new Error(`Unknown adapter: ${name}`);
      const ctx: RenderContext = {
        projectName: manifest.project.name,
        manifestVersion: manifest.version,
        tokenBudget: config.tokenBudgets["*"] ?? null,
        priorityOrder: memory.files
          .slice()
          .sort((a, b) => a.frontmatter.priority - b.frontmatter.priority)
          .map((f) => f.path),
        generatorVersion: serverVersion,
        now: new Date().toISOString(),
      };
      const generated = await adapter.render(memory, ctx);
      const combined = generated
        .map((g) => `<!-- ${g.path} -->\n${g.contents}`)
        .join("\n\n");
      return { contents: [{ uri, mimeType: "text/markdown", text: combined }] };
    }

    if (uri === SCAN_REPO_MAP_URI) {
      const text = await readFile(path.join(agentDir(cwd), "repo-map.json"), "utf8");
      return { contents: [{ uri, mimeType: "application/json", text }] };
    }

    if (uri === SCAN_STACK_URI) {
      const text = await readFile(path.join(agentDir(cwd), "stack.md"), "utf8");
      return { contents: [{ uri, mimeType: "text/markdown", text }] };
    }

    throw new Error(`Unknown resource URI: ${uri}`);
  });

  return server;
}

export async function runStdioServer(opts: ServerOpts): Promise<void> {
  const server = buildServer(opts);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
