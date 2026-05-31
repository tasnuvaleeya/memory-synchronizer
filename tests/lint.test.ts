import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { initCommand } from "../src/cli/init.js";
import { lintCommand } from "../src/cli/lint.js";
import { Logger } from "../src/core/logger.js";
import { UserError } from "../src/core/errors.js";
import { runLinter } from "../src/linter/engine.js";
import { BUILTIN_RULES } from "../src/linter/rules/index.js";
import { DEFAULT_POLICY } from "../src/core/policy.js";
import type { MemoryFile } from "../src/core/memory.js";

let root: string;
const quiet = new Logger({ quiet: true });

class Capturing extends Logger {
  public readonly stdout: string[] = [];
  constructor() {
    super({ quiet: true });
  }
  override print(msg: string): void {
    this.stdout.push(msg);
  }
}

function mkFile(overrides: Partial<MemoryFile> & { body: string; path?: string }): MemoryFile {
  return {
    path: overrides.path ?? "x.md",
    body: overrides.body,
    frontmatter: {
      name: "x",
      description: "x",
      source: "authored",
      priority: 50,
      applies_to: ["*"],
      tags: [],
    },
    sha: "a".repeat(64),
  };
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "agentctx-lint-"));
  await initCommand(root, {}, quiet);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("lint engine rules", () => {
  it("heading-hierarchy detects level jumps", () => {
    const f = mkFile({ body: "# A\n\n### B\n" });
    const out = runLinter([f], { rules: BUILTIN_RULES, policy: DEFAULT_POLICY, mtimes: new Map() });
    expect(out.find((x) => x.ruleId === "heading-hierarchy")).toBeTruthy();
  });

  it("banned-vague-phrases detects TODO", () => {
    const f = mkFile({ body: "# A\n\nTODO: write this section.\n" });
    const out = runLinter([f], { rules: BUILTIN_RULES, policy: DEFAULT_POLICY, mtimes: new Map() });
    const found = out.find((x) => x.ruleId === "banned-vague-phrases");
    expect(found?.message).toContain("TODO");
  });

  it("freshness flags old mtimes", () => {
    const f = mkFile({ body: "# A\n" });
    const old = Date.now() - 200 * 24 * 60 * 60 * 1000;
    const out = runLinter([f], {
      rules: BUILTIN_RULES,
      policy: DEFAULT_POLICY,
      mtimes: new Map([[f.path, old]]),
    });
    expect(out.find((x) => x.ruleId === "freshness")).toBeTruthy();
  });

  it("max-length flags oversized bodies", () => {
    const f = mkFile({ body: "x".repeat(30000) });
    const out = runLinter([f], { rules: BUILTIN_RULES, policy: DEFAULT_POLICY, mtimes: new Map() });
    expect(out.find((x) => x.ruleId === "max-length")).toBeTruthy();
  });

  it("required-sections flags missing headings declared in policy", () => {
    const f = mkFile({ body: "# A\n## Other\n", path: "architecture.md" });
    const policy = {
      ...DEFAULT_POLICY,
      lint: { ...DEFAULT_POLICY.lint, requiredSections: { "architecture.md": ["## Setup"] } },
    };
    const out = runLinter([f], { rules: BUILTIN_RULES, policy, mtimes: new Map() });
    const found = out.find((x) => x.ruleId === "required-sections");
    expect(found?.message).toContain("## Setup");
  });

  it("policy can disable a rule via level: off", () => {
    const f = mkFile({ body: "TODO: x\n# H\n" });
    const policy = {
      ...DEFAULT_POLICY,
      lint: { ...DEFAULT_POLICY.lint, rules: { "banned-vague-phrases": { level: "off" as const } } },
    };
    const out = runLinter([f], { rules: BUILTIN_RULES, policy, mtimes: new Map() });
    expect(out.find((x) => x.ruleId === "banned-vague-phrases")).toBeFalsy();
  });
});

describe("lint command", () => {
  it("--json reports zero errors on a fresh init", async () => {
    const logger = new Capturing();
    // Touch all memory files so freshness doesn't trip
    const now = new Date();
    const memDir = path.join(root, "agent");
    const all = ["coding-rules.md", "architecture.md", "domain-knowledge.md", "stack.md"];
    for (const f of all) {
      await utimes(path.join(memDir, f), now, now).catch(() => undefined);
    }
    await lintCommand(root, { json: true }, logger);
    const payload = JSON.parse(logger.stdout.join("\n")) as { errors: unknown[]; ok: boolean };
    expect(payload.errors.length).toBe(0);
  });

  it("exits with error when a required section is missing", async () => {
    await writeFile(
      path.join(root, "agentctx.policy.yaml"),
      `version: 1\nlint:\n  requiredSections:\n    coding-rules.md: ["## Nonexistent Section"]\n`,
      "utf8",
    );
    await expect(lintCommand(root, {}, quiet)).rejects.toThrow(UserError);
  });
});
