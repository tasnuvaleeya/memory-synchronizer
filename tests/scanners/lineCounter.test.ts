import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { measureFile } from "../../src/scanners/lineCounter.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "agentsync-lc-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("measureFile", () => {
  it("returns 0 lines for an empty file", async () => {
    const p = path.join(dir, "empty.ts");
    await writeFile(p, "", "utf8");
    const m = await measureFile(p);
    expect(m.lineCount).toBe(0);
    expect(m.isText).toBe(true);
    expect(m.sha).toMatch(/^[a-f0-9]{64}$/);
  });

  it("counts newlines exactly (wc -l semantics)", async () => {
    const p = path.join(dir, "three.ts");
    await writeFile(p, "a\nb\nc\n", "utf8");
    const m = await measureFile(p);
    expect(m.lineCount).toBe(3);
  });

  it("does not count a trailing line without newline", async () => {
    const p = path.join(dir, "no-trailing.ts");
    await writeFile(p, "a\nb\nc", "utf8");
    const m = await measureFile(p);
    expect(m.lineCount).toBe(2);
  });

  it("returns 0 lines for binary extensions", async () => {
    const p = path.join(dir, "image.png");
    await writeFile(p, Buffer.from([0, 1, 2, 3, 4]));
    const m = await measureFile(p);
    expect(m.lineCount).toBe(0);
    expect(m.isText).toBe(false);
    expect(m.sha).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces a stable sha across calls", async () => {
    const p = path.join(dir, "x.ts");
    await writeFile(p, "hello\nworld\n", "utf8");
    const a = await measureFile(p);
    const b = await measureFile(p);
    expect(a.sha).toBe(b.sha);
    expect(a.lineCount).toBe(b.lineCount);
  });
});
