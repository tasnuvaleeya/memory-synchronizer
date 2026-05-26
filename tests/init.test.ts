import { describe, it, expect } from "vitest";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { initCommand } from "../src/cli/init.js";
import { validateCommand } from "../src/cli/validate.js";
import { Logger } from "../src/core/logger.js";
import { sha256 } from "../src/core/paths.js";
import { UserError } from "../src/core/errors.js";

async function mkTmp(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "agentsync-init-"));
}

async function walk(root: string): Promise<string[]> {
  const out: string[] = [];
  async function rec(dir: string, prefix: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        await rec(abs, rel);
      } else {
        out.push(rel);
      }
    }
  }
  await rec(root, "");
  out.sort();
  return out;
}

async function fileShas(root: string): Promise<Record<string, string>> {
  const files = await walk(root);
  const result: Record<string, string> = {};
  for (const f of files) {
    const raw = await readFile(path.join(root, f), "utf8");
    result[f] = sha256(raw);
  }
  return result;
}

describe("init command", () => {
  const quiet = new Logger({ quiet: true });

  it("creates the expected file tree", async () => {
    const root = await mkTmp();
    try {
      await initCommand(root, {}, quiet);
      const files = await walk(root);
      expect(files).toEqual([
        ".agentsync/config.yaml",
        "agent/.agentsyncignore",
        "agent/architecture.md",
        "agent/coding-rules.md",
        "agent/domain-knowledge.md",
        "agent/manifest.yaml",
        "agent/stack.md",
        "agent/workflows/debugging.md",
        "agent/workflows/deployment.md",
        "agent/workflows/testing.md",
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("produces byte-identical output across runs (determinism)", async () => {
    const a = await mkTmp();
    const b = await mkTmp();
    try {
      await initCommand(a, {}, quiet);
      await initCommand(b, {}, quiet);
      const ah = await fileShas(a);
      const bh = await fileShas(b);
      expect(ah).toEqual(bh);
    } finally {
      await rm(a, { recursive: true, force: true });
      await rm(b, { recursive: true, force: true });
    }
  });

  it("substitutes projectName from package.json", async () => {
    const root = await mkTmp();
    try {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(
        path.join(root, "package.json"),
        JSON.stringify({ name: "@myorg/widget", version: "0.0.0" }),
        "utf8",
      );
      await initCommand(root, {}, quiet);
      const arch = await readFile(path.join(root, "agent", "architecture.md"), "utf8");
      expect(arch).toContain("widget");
      expect(arch).not.toContain("{{projectName}}");
      const manifest = await readFile(path.join(root, "agent", "manifest.yaml"), "utf8");
      expect(manifest).toContain("name: widget");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("falls back to directory basename when no package.json exists", async () => {
    const parent = await mkTmp();
    try {
      const root = path.join(parent, "my-project");
      const { mkdir } = await import("node:fs/promises");
      await mkdir(root);
      await initCommand(root, {}, quiet);
      const arch = await readFile(path.join(root, "agent", "architecture.md"), "utf8");
      expect(arch).toContain("my-project");
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it("refuses to overwrite an existing non-empty agent dir without --yes", async () => {
    const root = await mkTmp();
    try {
      await initCommand(root, {}, quiet);
      await expect(initCommand(root, {}, quiet)).rejects.toThrow(UserError);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("validate exits cleanly on a freshly-initialized repo", async () => {
    const root = await mkTmp();
    try {
      await initCommand(root, {}, quiet);
      await expect(validateCommand(root, {}, quiet)).resolves.toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("validate fails when manifest is removed", async () => {
    const root = await mkTmp();
    try {
      await initCommand(root, {}, quiet);
      await rm(path.join(root, "agent", "manifest.yaml"));
      await expect(validateCommand(root, {}, quiet)).rejects.toThrow(UserError);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("validate reports an error when a non-generated declared file is missing", async () => {
    const root = await mkTmp();
    try {
      await initCommand(root, {}, quiet);
      await rm(path.join(root, "agent", "coding-rules.md"));
      await expect(validateCommand(root, {}, quiet)).rejects.toThrow(UserError);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("validate tolerates a missing `generated` file (warning only)", async () => {
    const root = await mkTmp();
    try {
      await initCommand(root, {}, quiet);
      await rm(path.join(root, "agent", "stack.md"));
      // Should not throw under non-strict mode.
      await expect(validateCommand(root, {}, quiet)).resolves.toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("init creates a config file with the expected shape", async () => {
    const root = await mkTmp();
    try {
      await initCommand(root, {}, quiet);
      const cfg = await readFile(path.join(root, ".agentsync", "config.yaml"), "utf8");
      expect(cfg).toContain("defaultAdapters:");
      expect(cfg).toContain("- claude");
      expect(cfg).toMatch(/\n$/); // LF-terminated
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("every generated file ends with a newline", async () => {
    const root = await mkTmp();
    try {
      await initCommand(root, {}, quiet);
      const files = await walk(root);
      for (const f of files) {
        const raw = await readFile(path.join(root, f), "utf8");
        const lastChar = raw.slice(-1);
        // Allow .agentsyncignore (template) to be either; the rest must be LF-terminated.
        if (lastChar !== "\n" && !f.endsWith(".agentsyncignore")) {
          throw new Error(`${f} is not LF-terminated`);
        }
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("init does not embed any timestamp in output (no `now`-dependent content)", async () => {
    const root = await mkTmp();
    try {
      await initCommand(root, {}, quiet);
      const files = await walk(root);
      const yearRe = /\b20\d\d-\d\d-\d\dT/; // ISO timestamp shape
      for (const f of files) {
        const raw = await readFile(path.join(root, f), "utf8");
        expect(raw).not.toMatch(yearRe);
      }
      // Also: writes are real files, not symlinks
      const st = await stat(path.join(root, "agent", "manifest.yaml"));
      expect(st.isFile()).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
