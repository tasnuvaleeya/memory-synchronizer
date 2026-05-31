import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { initCommand } from "../src/cli/init.js";
import { syncCommand } from "../src/cli/sync.js";
import { scanCommand } from "../src/cli/scan.js";
import { buildServer } from "../src/mcp/server.js";
import { Logger } from "../src/core/logger.js";

let root: string;
const quiet = new Logger({ quiet: true });

async function pair(cwd: string): Promise<Client> {
  const server = buildServer({ cwd, serverVersion: "test" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client(
    { name: "test-client", version: "0.0.0" },
    { capabilities: {} },
  );
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "agentsync-mcp-"));
  await initCommand(root, {}, quiet);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("mcp server", () => {
  it("lists manifest, memory files, and adapter outputs", async () => {
    const client = await pair(root);
    try {
      const { resources } = await client.listResources();
      const uris = resources.map((r) => r.uri);
      expect(uris).toContain("agentsync://manifest");
      expect(uris).toContain("agentsync://memory/list");
      expect(uris).toContain("agentsync://memory/coding-rules.md");
      expect(uris.some((u) => u.startsWith("agentsync://adapters/claude"))).toBe(true);
    } finally {
      await client.close();
    }
  });

  it("reads the manifest as YAML", async () => {
    const client = await pair(root);
    try {
      const res = await client.readResource({ uri: "agentsync://manifest" });
      expect(res.contents[0]?.mimeType).toBe("application/yaml");
      expect(res.contents[0]?.text as string).toContain("version: 1");
    } finally {
      await client.close();
    }
  });

  it("reads an individual memory file as markdown", async () => {
    const client = await pair(root);
    try {
      const res = await client.readResource({
        uri: "agentsync://memory/coding-rules.md",
      });
      expect(res.contents[0]?.mimeType).toBe("text/markdown");
      expect(res.contents[0]?.text as string).toContain("name: coding-rules");
    } finally {
      await client.close();
    }
  });

  it("memory/list returns JSON with frontmatter for each file", async () => {
    const client = await pair(root);
    try {
      const res = await client.readResource({ uri: "agentsync://memory/list" });
      expect(res.contents[0]?.mimeType).toBe("application/json");
      const list = JSON.parse(res.contents[0]!.text as string) as Array<{
        path: string;
        frontmatter: { name: string };
      }>;
      expect(list.length).toBeGreaterThan(0);
      expect(list.some((e) => e.path === "coding-rules.md")).toBe(true);
    } finally {
      await client.close();
    }
  });

  it("renders adapter output on demand", async () => {
    const client = await pair(root);
    try {
      const res = await client.readResource({ uri: "agentsync://adapters/claude" });
      expect(res.contents[0]?.text as string).toContain("<!-- agentsync:generated -->");
    } finally {
      await client.close();
    }
  });

  it("exposes scan artifacts only after scan has run", async () => {
    let client = await pair(root);
    try {
      const before = await client.listResources();
      const beforeUris = before.resources.map((r) => r.uri);
      expect(beforeUris).not.toContain("agentsync://scan/repo-map");
    } finally {
      await client.close();
    }

    await scanCommand(root, {}, quiet);

    client = await pair(root);
    try {
      const after = await client.listResources();
      const afterUris = after.resources.map((r) => r.uri);
      expect(afterUris).toContain("agentsync://scan/repo-map");
      expect(afterUris).toContain("agentsync://scan/stack");
    } finally {
      await client.close();
    }
  });

  it("reflects on-disk sync state via the adapter resource", async () => {
    await syncCommand(root, { adapter: ["claude"] }, quiet);
    const client = await pair(root);
    try {
      const res = await client.readResource({ uri: "agentsync://adapters/claude" });
      expect(res.contents[0]?.text as string).toContain("CLAUDE.md");
    } finally {
      await client.close();
    }
  });
});
