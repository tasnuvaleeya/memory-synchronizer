import { describe, it, expect } from "vitest";
import { parseIgnoreLines } from "../src/core/ignore.js";

describe("parseIgnoreLines", () => {
  it("strips comments and blanks, preserves order", () => {
    const raw = [
      "# header",
      "",
      "node_modules",
      "*.draft.md",
      "# trailing comment",
      "scratch/",
      "",
    ].join("\n");
    expect(parseIgnoreLines(raw)).toEqual(["node_modules", "*.draft.md", "scratch/"]);
  });

  it("handles CRLF input", () => {
    const raw = "a\r\n# c\r\nb\r\n";
    expect(parseIgnoreLines(raw)).toEqual(["a", "b"]);
  });

  it("returns an empty array for an empty file", () => {
    expect(parseIgnoreLines("")).toEqual([]);
  });
});
