import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { detectStack } from "../../src/scanners/stackDetector.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "agentctx-stack-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("detectStack", () => {
  it("returns empty arrays for an empty repo", async () => {
    const s = await detectStack(root);
    expect(s.languages).toEqual([]);
    expect(s.runtimes).toEqual([]);
    expect(s.packageManagers).toEqual([]);
    expect(s.frameworks).toEqual([]);
    expect(s.ci).toEqual([]);
  });

  it("detects a TypeScript/Node project with pnpm and Next.js", async () => {
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "demo",
        dependencies: { next: "^15", react: "^18" },
        devDependencies: { vitest: "^1" },
      }),
      "utf8",
    );
    await writeFile(path.join(root, "tsconfig.json"), "{}", "utf8");
    await writeFile(path.join(root, "pnpm-lock.yaml"), "", "utf8");
    const s = await detectStack(root);
    expect(s.languages).toContain("TypeScript");
    expect(s.languages).toContain("JavaScript");
    expect(s.runtimes).toContain("Node.js");
    expect(s.packageManagers).toContain("pnpm");
    expect(s.frameworks).toEqual(expect.arrayContaining(["Next.js", "React", "Vitest"]));
  });

  it("detects a Python project with FastAPI via pyproject.toml", async () => {
    await writeFile(
      path.join(root, "pyproject.toml"),
      `[project]\nname = "demo"\ndependencies = ["fastapi", "pytest"]\n\n[tool.poetry]\n`,
      "utf8",
    );
    const s = await detectStack(root);
    expect(s.languages).toContain("Python");
    expect(s.runtimes).toContain("Python");
    expect(s.packageManagers).toContain("poetry");
    expect(s.frameworks).toContain("FastAPI");
    expect(s.frameworks).toContain("pytest");
  });

  it("detects GitHub Actions CI", async () => {
    await mkdir(path.join(root, ".github", "workflows"), { recursive: true });
    await writeFile(path.join(root, ".github", "workflows", "ci.yml"), "name: ci\n", "utf8");
    const s = await detectStack(root);
    expect(s.ci).toContain("GitHub Actions");
  });

  it("output is sorted (deterministic)", async () => {
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ dependencies: { vue: "^3", react: "^18", svelte: "^4" } }),
      "utf8",
    );
    const a = await detectStack(root);
    const b = await detectStack(root);
    expect(a).toEqual(b);
    expect(a.frameworks).toEqual([...a.frameworks].sort());
  });
});
