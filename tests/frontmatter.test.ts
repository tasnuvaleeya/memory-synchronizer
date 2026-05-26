import { describe, it, expect } from "vitest";
import { parseFrontmatter } from "../src/core/frontmatter.js";
import { UserError } from "../src/core/errors.js";

const VALID = `---
name: example
description: A small example file
source: authored
priority: 20
applies_to: ["*"]
tags: [test]
---
# Hello

body content
`;

describe("parseFrontmatter", () => {
  it("parses a well-formed file", () => {
    const { frontmatter, body } = parseFrontmatter("example.md", VALID);
    expect(frontmatter.name).toBe("example");
    expect(frontmatter.priority).toBe(20);
    expect(frontmatter.tags).toEqual(["test"]);
    expect(body.startsWith("# Hello")).toBe(true);
  });

  it("applies defaults for missing optional fields", () => {
    const minimal = `---\nname: m\ndescription: d\n---\n`;
    const { frontmatter, body } = parseFrontmatter("m.md", minimal);
    expect(frontmatter.source).toBe("authored");
    expect(frontmatter.priority).toBe(50);
    expect(frontmatter.applies_to).toEqual(["*"]);
    expect(frontmatter.tags).toEqual([]);
    expect(body).toBe("");
  });

  it("strips a UTF-8 BOM before parsing", () => {
    const withBom = "﻿" + VALID;
    const { frontmatter } = parseFrontmatter("bom.md", withBom);
    expect(frontmatter.name).toBe("example");
  });

  it("accepts CRLF line endings", () => {
    const crlf = VALID.replace(/\n/g, "\r\n");
    const { frontmatter } = parseFrontmatter("crlf.md", crlf);
    expect(frontmatter.name).toBe("example");
  });

  it("throws when the frontmatter block is missing", () => {
    expect(() => parseFrontmatter("none.md", "# no frontmatter\nbody")).toThrow(UserError);
  });

  it("throws when YAML is malformed", () => {
    const bad = `---\nname: [unterminated\n---\n`;
    expect(() => parseFrontmatter("bad.md", bad)).toThrow(UserError);
  });

  it("throws when required fields are missing", () => {
    const incomplete = `---\ndescription: missing-name\n---\n`;
    expect(() => parseFrontmatter("inc.md", incomplete)).toThrow(UserError);
  });

  it("throws when priority is out of range", () => {
    const bad = `---\nname: x\ndescription: y\npriority: 999\n---\n`;
    expect(() => parseFrontmatter("range.md", bad)).toThrow(UserError);
  });

  it("rejects unknown frontmatter keys (strict mode)", () => {
    const extra = `---\nname: x\ndescription: y\nbogus: true\n---\n`;
    expect(() => parseFrontmatter("extra.md", extra)).toThrow(UserError);
  });
});
