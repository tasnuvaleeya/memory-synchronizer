import { describe, it, expect } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { compareStrings, sha256, toPosix, writeFileLF } from "../src/core/paths.js";

describe("paths", () => {
  it("toPosix replaces backslashes (no-op on POSIX)", () => {
    expect(toPosix("a/b/c")).toBe("a/b/c");
    expect(toPosix("a\\b\\c".split("\\").join(path.sep))).toBe(
      "a/b/c".split("/").join(path.sep).split(path.sep).join("/"),
    );
  });

  it("compareStrings is locale-independent", () => {
    expect(compareStrings("a", "b")).toBe(-1);
    expect(compareStrings("b", "a")).toBe(1);
    expect(compareStrings("a", "a")).toBe(0);
  });

  it("sha256 produces a 64-char lowercase hex", () => {
    const h = sha256("hello");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("writeFileLF normalizes CRLF and creates parent dirs", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "agentsync-"));
    try {
      const out = path.join(dir, "nested", "deeper", "file.txt");
      await writeFileLF(out, "alpha\r\nbeta\r\n");
      const raw = await readFile(out, "utf8");
      expect(raw).toBe("alpha\nbeta\n");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
