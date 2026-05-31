import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadPolicy, PolicySchema, DEFAULT_POLICY } from "../src/core/policy.js";
import { UserError } from "../src/core/errors.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "agentsync-policy-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("PolicySchema", () => {
  it("parses a minimal valid policy", () => {
    const p = PolicySchema.parse({ version: 1 });
    expect(p.requiredFiles).toEqual([]);
    expect(p.lint.rules).toEqual({});
  });

  it("rejects unknown top-level keys", () => {
    expect(() => PolicySchema.parse({ version: 1, foo: 1 })).toThrow();
  });

  it("parses a fully-populated policy", () => {
    const p = PolicySchema.parse({
      version: 1,
      requiredFiles: ["coding-rules.md"],
      requiredAdapters: ["claude"],
      lint: {
        rules: {
          "banned-vague-phrases": { level: "error", extra: ["WIP"] },
          freshness: { level: "warn", maxAgeDays: 30 },
        },
        requiredSections: { "architecture.md": ["## Overview"] },
      },
      tokenBudgets: { claude: 8000 },
    });
    expect(p.requiredFiles).toEqual(["coding-rules.md"]);
    expect(p.lint.rules["banned-vague-phrases"]?.extra).toEqual(["WIP"]);
    expect(p.tokenBudgets["claude"]).toBe(8000);
  });
});

describe("loadPolicy", () => {
  it("returns defaults when no file is present", async () => {
    const p = await loadPolicy(root, undefined);
    expect(p).toEqual(DEFAULT_POLICY);
  });

  it("loads agentsync.policy.yaml from repo root", async () => {
    await writeFile(
      path.join(root, "agentsync.policy.yaml"),
      "version: 1\nrequiredFiles: [coding-rules.md]\n",
      "utf8",
    );
    const p = await loadPolicy(root, undefined);
    expect(p.requiredFiles).toEqual(["coding-rules.md"]);
  });

  it("honors an explicit --policy path", async () => {
    const explicit = path.join(root, "my.policy.yaml");
    await writeFile(explicit, "version: 1\nrequiredAdapters: [cursor]\n", "utf8");
    const p = await loadPolicy(root, "my.policy.yaml");
    expect(p.requiredAdapters).toEqual(["cursor"]);
  });

  it("throws UserError when explicit policy is missing", async () => {
    await expect(loadPolicy(root, "nope.yaml")).rejects.toThrow(UserError);
  });

  it("throws UserError on schema-invalid policy", async () => {
    await writeFile(
      path.join(root, "agentsync.policy.yaml"),
      "version: 2\n",
      "utf8",
    );
    await expect(loadPolicy(root, undefined)).rejects.toThrow(UserError);
  });
});
