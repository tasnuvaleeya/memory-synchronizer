import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { existsSync } from "node:fs";
import { initCommand } from "../src/cli/init.js";
import { exportCommand } from "../src/cli/export.js";
import { importCommand } from "../src/cli/import.js";
import { Logger } from "../src/core/logger.js";
import { UserError } from "../src/core/errors.js";

let root: string;
const quiet = new Logger({ quiet: true });

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "agentsync-ei-"));
  await initCommand(root, {}, quiet);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("export command", () => {
  it("writes a tarball under the requested path", async () => {
    const out = path.join(root, "bundle.tar.gz");
    await exportCommand(root, "bundle.tar.gz", {}, quiet);
    expect(existsSync(out)).toBe(true);
  });

  it("--json reports the file count", async () => {
    const stdout: string[] = [];
    const logger = new (class extends Logger {
      override print(msg: string): void {
        stdout.push(msg);
      }
    })({ quiet: true });
    await exportCommand(root, "bundle.tar.gz", { json: true }, logger);
    const payload = JSON.parse(stdout.join("\n")) as { fileCount: number };
    expect(payload.fileCount).toBeGreaterThan(0);
  });
});

describe("import command", () => {
  it("round-trips a tarball: export → import → equivalent file set", async () => {
    const archive = path.join(root, "bundle.tar.gz");
    await exportCommand(root, "bundle.tar.gz", {}, quiet);

    // Capture original file list
    const orig = (await readdir(path.join(root, "agent"), { recursive: true })).sort();

    // Set up a clean target
    const dest = await mkdtemp(path.join(tmpdir(), "agentsync-ei-dest-"));
    try {
      await importCommand(dest, archive, {}, quiet);
      const imported = (
        await readdir(path.join(dest, "agent"), { recursive: true })
      ).sort();
      expect(imported).toEqual(orig);

      // Check one file's content matches byte-for-byte
      const a = await readFile(path.join(root, "agent", "coding-rules.md"), "utf8");
      const b = await readFile(path.join(dest, "agent", "coding-rules.md"), "utf8");
      expect(b).toBe(a);
    } finally {
      await rm(dest, { recursive: true, force: true });
    }
  });

  it("imports a local directory", async () => {
    const src = await mkdtemp(path.join(tmpdir(), "agentsync-ei-src-"));
    await initCommand(src, {}, quiet);

    const dest = await mkdtemp(path.join(tmpdir(), "agentsync-ei-dest-"));
    try {
      await importCommand(dest, path.join(src, "agent"), {}, quiet);
      expect(existsSync(path.join(dest, "agent", "coding-rules.md"))).toBe(true);
    } finally {
      await rm(src, { recursive: true, force: true });
      await rm(dest, { recursive: true, force: true });
    }
  });

  it("refuses to overwrite a non-empty destination without --force", async () => {
    const archive = path.join(root, "bundle.tar.gz");
    await exportCommand(root, "bundle.tar.gz", {}, quiet);
    // root already has an agent/ dir from init
    await expect(importCommand(root, archive, {}, quiet)).rejects.toThrow(UserError);
  });

  it("--force overwrites an existing destination", async () => {
    const archive = path.join(root, "bundle.tar.gz");
    await exportCommand(root, "bundle.tar.gz", {}, quiet);
    await expect(
      importCommand(root, archive, { force: true }, quiet),
    ).resolves.not.toThrow();
  });
});
