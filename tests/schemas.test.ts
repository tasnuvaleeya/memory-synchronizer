import { describe, it, expect } from "vitest";
import { ManifestSchema, FrontmatterSchema } from "../src/core/manifest.js";
import { ConfigSchema, DEFAULT_CONFIG } from "../src/core/config.js";
import { MemoryFileSchema } from "../src/core/memory.js";

describe("ManifestSchema", () => {
  it("accepts a minimal valid manifest", () => {
    const parsed = ManifestSchema.parse({
      version: 1,
      project: { name: "demo" },
      targets: ["claude"],
      files: [{ path: "coding-rules.md", source: "authored" }],
    });
    expect(parsed.version).toBe(1);
    expect(parsed.generation.scanner).toBe("web-tree-sitter");
    expect(parsed.files[0]?.priority).toBe(50);
  });

  it("rejects an unknown source type", () => {
    expect(() =>
      ManifestSchema.parse({
        version: 1,
        project: { name: "demo" },
        targets: ["claude"],
        files: [{ path: "x.md", source: "magic" }],
      }),
    ).toThrow();
  });

  it("rejects empty targets", () => {
    expect(() =>
      ManifestSchema.parse({
        version: 1,
        project: { name: "demo" },
        targets: [],
        files: [],
      }),
    ).toThrow();
  });
});

describe("FrontmatterSchema", () => {
  it("rejects priority above 100", () => {
    expect(() =>
      FrontmatterSchema.parse({ name: "x", description: "y", priority: 101 }),
    ).toThrow();
  });
});

describe("ConfigSchema", () => {
  it("produces sensible defaults", () => {
    expect(DEFAULT_CONFIG.defaultAdapters).toEqual(["claude", "agents-md"]);
    expect(DEFAULT_CONFIG.tokenBudgets).toEqual({});
    expect(DEFAULT_CONFIG.plugins.adapters).toEqual([]);
  });

  it("rejects unknown keys", () => {
    expect(() => ConfigSchema.parse({ bogus: 1 })).toThrow();
  });
});

describe("MemoryFileSchema", () => {
  it("requires a 64-char sha", () => {
    expect(() =>
      MemoryFileSchema.parse({
        path: "x.md",
        frontmatter: { name: "x", description: "y" },
        body: "",
        sha: "short",
      }),
    ).toThrow();
  });
});
