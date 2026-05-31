import { describe, it, expect } from "vitest";
import {
  resolveLanguage,
  extensionOf,
  isTextExtension,
} from "../../src/scanners/languageMap.js";

describe("extensionOf", () => {
  it("returns lowercase extension without dot", () => {
    expect(extensionOf("foo.TS")).toBe("ts");
    expect(extensionOf("path/to/file.py")).toBe("py");
  });

  it("returns empty string when no extension", () => {
    expect(extensionOf("Dockerfile")).toBe("");
    expect(extensionOf("README")).toBe("");
  });

  it("ignores dots in directory names", () => {
    expect(extensionOf("foo.bar/baz")).toBe("");
  });
});

describe("resolveLanguage", () => {
  it("returns the canonical language for known extensions", () => {
    expect(resolveLanguage("a.ts")).toBe("TypeScript");
    expect(resolveLanguage("a.tsx")).toBe("TypeScript");
    expect(resolveLanguage("a.py")).toBe("Python");
    expect(resolveLanguage("a.go")).toBe("Go");
    expect(resolveLanguage("a.rs")).toBe("Rust");
  });

  it("returns null for unknown / unmapped extensions", () => {
    expect(resolveLanguage("a.xyz")).toBeNull();
    expect(resolveLanguage("Dockerfile")).toBeNull();
  });

  it("applies user overrides", () => {
    expect(resolveLanguage("a.ts", { ts: "MyLang" })).toBe("MyLang");
    expect(resolveLanguage("a.xyz", { xyz: "Xenon" })).toBe("Xenon");
  });
});

describe("isTextExtension", () => {
  it("recognizes source files as text", () => {
    expect(isTextExtension("a.ts")).toBe(true);
    expect(isTextExtension("a.py")).toBe(true);
  });

  it("recognizes common non-source text files", () => {
    expect(isTextExtension("a.txt")).toBe(true);
    expect(isTextExtension("a.env")).toBe(true);
  });

  it("rejects extensionless files", () => {
    expect(isTextExtension("Dockerfile")).toBe(false);
  });
});
