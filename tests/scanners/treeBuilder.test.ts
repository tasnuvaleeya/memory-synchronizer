import { describe, it, expect } from "vitest";
import { buildTree } from "../../src/scanners/treeBuilder.js";
import type { FileFact } from "../../src/scanners/types.js";

function fact(p: string): FileFact {
  return {
    path: p,
    role: "source",
    language: "TypeScript",
    lineCount: 10,
    sha: "a".repeat(64),
  };
}

describe("buildTree", () => {
  it("builds a flat root for top-level files", () => {
    const tree = buildTree([fact("a.ts"), fact("b.ts")], "root");
    expect(tree.name).toBe("root");
    expect(tree.type).toBe("dir");
    expect(tree.children?.map((c) => c.name)).toEqual(["a.ts", "b.ts"]);
  });

  it("nests directories", () => {
    const tree = buildTree(
      [fact("src/a.ts"), fact("src/sub/b.ts"), fact("README.md")],
      "root",
    );
    // Dirs first, then files (alphabetical within each)
    expect(tree.children?.map((c) => c.name)).toEqual(["src", "README.md"]);
    const src = tree.children?.find((c) => c.name === "src");
    expect(src?.children?.map((c) => c.name)).toEqual(["sub", "a.ts"]);
  });

  it("is deterministic across input orderings", () => {
    const a = buildTree(
      [fact("z.ts"), fact("a.ts"), fact("src/b.ts"), fact("src/a.ts")],
      "root",
    );
    const b = buildTree(
      [fact("src/a.ts"), fact("a.ts"), fact("src/b.ts"), fact("z.ts")].sort((x, y) =>
        x.path < y.path ? -1 : 1,
      ),
      "root",
    );
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("preserves file metadata on leaf nodes", () => {
    const tree = buildTree([fact("a.ts")], "root");
    const leaf = tree.children?.[0];
    expect(leaf?.type).toBe("file");
    expect(leaf?.lineCount).toBe(10);
    expect(leaf?.language).toBe("TypeScript");
    expect(leaf?.role).toBe("source");
  });
});
