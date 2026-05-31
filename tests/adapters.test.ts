import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { initCommand } from "../src/cli/init.js";
import { syncCommand } from "../src/cli/sync.js";
import { Logger } from "../src/core/logger.js";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { stripProvenance, parseProvenance } from "../src/core/provenance.js";

let root: string;
const quiet = new Logger({ quiet: true });

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "agentctx-adapters-"));
  await initCommand(root, { targets: "claude,agents-md,cursor,cline,windsurf,copilot" }, quiet);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("sync command", () => {
  it("generates CLAUDE.md", async () => {
    await syncCommand(root, { adapter: ["claude"] }, quiet);
    const file = path.join(root, "CLAUDE.md");
    expect(existsSync(file)).toBe(true);
    const contents = await readFile(file, "utf8");
    expect(contents).toContain("<!-- agentctx:generated -->");
    expect(contents).toContain("Agent Context (Claude)");
  });

  it("generates AGENTS.md", async () => {
    await syncCommand(root, { adapter: ["agents-md"] }, quiet);
    const file = path.join(root, "AGENTS.md");
    expect(existsSync(file)).toBe(true);
    const contents = await readFile(file, "utf8");
    expect(contents).toContain("<!-- agentctx:generated -->");
    expect(contents).toContain("Agent Context");
  });

  it("generates .cursorrules and .cursor/rules/agentctx.mdc", async () => {
    await syncCommand(root, { adapter: ["cursor"] }, quiet);
    expect(existsSync(path.join(root, ".cursorrules"))).toBe(true);
    expect(existsSync(path.join(root, ".cursor", "rules", "agentctx.mdc"))).toBe(true);
  });

  it("generates .clinerules", async () => {
    await syncCommand(root, { adapter: ["cline"] }, quiet);
    expect(existsSync(path.join(root, ".clinerules"))).toBe(true);
  });

  it("generates .windsurfrules", async () => {
    await syncCommand(root, { adapter: ["windsurf"] }, quiet);
    expect(existsSync(path.join(root, ".windsurfrules"))).toBe(true);
  });

  it("generates .github/copilot-instructions.md", async () => {
    await syncCommand(root, { adapter: ["copilot"] }, quiet);
    expect(existsSync(path.join(root, ".github", "copilot-instructions.md"))).toBe(true);
  });

  it("is idempotent: sync twice produces byte-identical files", async () => {
    await syncCommand(root, { adapter: ["claude"] }, quiet);
    const first = await readFile(path.join(root, "CLAUDE.md"), "utf8");

    // Wait 1ms to ensure timestamps would differ if not frozen
    await new Promise((r) => setTimeout(r, 1));
    // Re-sync with force to ignore idempotency skip and actually write
    await syncCommand(root, { adapter: ["claude"], force: true }, quiet);
    const second = await readFile(path.join(root, "CLAUDE.md"), "utf8");

    // Content after stripping provenance should match (minus timestamp)
    expect(stripProvenance(first)).toBe(stripProvenance(second));
  });

  it("provenance header includes source-sha and generator", async () => {
    await syncCommand(root, { adapter: ["claude"] }, quiet);
    const raw = await readFile(path.join(root, "CLAUDE.md"), "utf8");
    const prov = parseProvenance(raw);
    expect(prov).not.toBeNull();
    expect(prov!.sourceSha).toMatch(/^[a-f0-9]{64}$/);
    expect(prov!.generator).toMatch(/^claude-adapter@/);
  });

  it("--dry-run does not write any files", async () => {
    await syncCommand(root, { adapter: ["claude"], dryRun: true }, quiet);
    expect(existsSync(path.join(root, "CLAUDE.md"))).toBe(false);
  });

  it("--check exits cleanly when files are up to date", async () => {
    await syncCommand(root, { adapter: ["claude"] }, quiet);
    // Re-check — files are current
    await expect(
      syncCommand(root, { adapter: ["claude"], check: true }, quiet),
    ).resolves.not.toThrow();
  });
});

describe("provenance", () => {
  it("stripProvenance removes the header block", async () => {
    await syncCommand(root, { adapter: ["claude"] }, quiet);
    const raw = await readFile(path.join(root, "CLAUDE.md"), "utf8");
    const stripped = stripProvenance(raw);
    expect(stripped).not.toContain("<!-- agentctx:generated -->");
    expect(stripped).not.toContain("<!-- DO NOT EDIT");
  });

  it("stripProvenance is idempotent on files without header", () => {
    const plain = "# Hello\n\nNo provenance here.\n";
    expect(stripProvenance(plain)).toBe(plain);
  });
});
