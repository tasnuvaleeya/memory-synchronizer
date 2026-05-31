import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { existsSync } from "node:fs";
import { initCommand } from "../src/cli/init.js";
import { scanCommand } from "../src/cli/scan.js";
import { Logger } from "../src/core/logger.js";
import { DriftError } from "../src/core/errors.js";

let root: string;
const quiet = new Logger({ quiet: true });

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "agentctx-scan-"));
  await initCommand(root, {}, quiet);
  // Seed a small TS source file so the scanner has something to count.
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(path.join(root, "src", "index.ts"), "export const x = 1;\n", "utf8");
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ name: "demo", dependencies: { hono: "^4" } }),
    "utf8",
  );
  await writeFile(path.join(root, "tsconfig.json"), "{}", "utf8");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("scan command", () => {
  it("generates agent/repo-map.json and agent/stack.md", async () => {
    await scanCommand(root, {}, quiet);
    expect(existsSync(path.join(root, "agent", "repo-map.json"))).toBe(true);
    expect(existsSync(path.join(root, "agent", "stack.md"))).toBe(true);
  });

  it("repo-map.json includes our seeded source file", async () => {
    await scanCommand(root, {}, quiet);
    const raw = await readFile(path.join(root, "agent", "repo-map.json"), "utf8");
    const parsed = JSON.parse(raw) as {
      summary: { totalFiles: number; languages: Array<{ language: string }> };
      files: Array<{ path: string }>;
    };
    expect(parsed.summary.totalFiles).toBeGreaterThan(0);
    expect(parsed.files.some((f) => f.path === "src/index.ts")).toBe(true);
    expect(parsed.summary.languages.some((l) => l.language === "TypeScript")).toBe(true);
  });

  it("stack.md mentions detected frameworks", async () => {
    await scanCommand(root, {}, quiet);
    const md = await readFile(path.join(root, "agent", "stack.md"), "utf8");
    expect(md).toContain("<!-- agentctx:generated -->");
    expect(md).toContain("TypeScript");
    expect(md).toContain("Hono");
  });

  it("is idempotent: repo-map.json is byte-identical on re-run", async () => {
    await scanCommand(root, {}, quiet);
    const first = await readFile(path.join(root, "agent", "repo-map.json"), "utf8");
    await new Promise((r) => setTimeout(r, 5));
    await scanCommand(root, {}, quiet);
    const second = await readFile(path.join(root, "agent", "repo-map.json"), "utf8");
    expect(second).toBe(first);
  });

  it("--check passes on a fresh scan", async () => {
    await scanCommand(root, {}, quiet);
    await expect(scanCommand(root, { check: true }, quiet)).resolves.not.toThrow();
  });

  it("--check fails when source files have changed", async () => {
    await scanCommand(root, {}, quiet);
    // Mutate: add another file
    await writeFile(path.join(root, "src", "added.ts"), "export const y = 2;\n", "utf8");
    await expect(scanCommand(root, { check: true }, quiet)).rejects.toThrow(DriftError);
  });

  it("writes a cache file under .agentctx/cache/scan.json", async () => {
    await scanCommand(root, {}, quiet);
    expect(existsSync(path.join(root, ".agentctx", "cache", "scan.json"))).toBe(true);
  });
});
