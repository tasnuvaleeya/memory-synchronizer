import { describe, it, expect } from "vitest";
import {
  type Adapter,
  type GeneratedFile,
  type MemorySet,
  type RenderContext,
  FrontmatterSchema,
  injectProvenance,
  stripProvenance,
  contentChecksum,
  computeSourceSha,
  applyTokenBudget,
} from "../src/index.js";

const sampleMemory: MemorySet = {
  manifestVersion: 1,
  files: [
    {
      path: "a.md",
      frontmatter: FrontmatterSchema.parse({
        name: "a",
        description: "a",
        priority: 10,
      }),
      body: "First file body.\n",
      sha: "a".repeat(64),
    },
    {
      path: "b.md",
      frontmatter: FrontmatterSchema.parse({
        name: "b",
        description: "b",
        priority: 20,
      }),
      body: "Second file body.\n",
      sha: "b".repeat(64),
    },
  ],
};

const sampleCtx: RenderContext = {
  projectName: "test",
  manifestVersion: 1,
  tokenBudget: null,
  priorityOrder: ["a.md", "b.md"],
  generatorVersion: "0.1.0",
  now: "2025-01-01T00:00:00.000Z",
};

describe("adapter SDK contract", () => {
  it("third-party adapter satisfies the Adapter interface", async () => {
    const myAdapter: Adapter = {
      name: "my-adapter",
      version: "1.0.0",
      outputPaths: ["MY_FILE.md"],
      async render(memory, ctx): Promise<GeneratedFile[]> {
        const { sections } = applyTokenBudget(memory, ctx, "my-adapter");
        const body = sections.map((s) => s.body).join("\n");
        const sourceSha = computeSourceSha(memory);
        const contents = injectProvenance(body, {
          sourceSha,
          generator: `my-adapter@1.0.0`,
          generatedAt: ctx.now,
        });
        return [
          {
            path: "MY_FILE.md",
            contents,
            checksum: contentChecksum(contents),
            sourceSha,
          },
        ];
      },
    };

    const out = await myAdapter.render(sampleMemory, sampleCtx);
    expect(out).toHaveLength(1);
    expect(out[0]!.contents).toContain("<!-- agentctx:generated -->");
    expect(stripProvenance(out[0]!.contents)).toContain("First file body.");
    expect(out[0]!.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it("computeSourceSha is order-independent", () => {
    const a = computeSourceSha(sampleMemory);
    const reversed: MemorySet = {
      ...sampleMemory,
      files: [...sampleMemory.files].reverse(),
    };
    expect(computeSourceSha(reversed)).toBe(a);
  });

  it("applyTokenBudget honors applies_to filtering", () => {
    const restricted: MemorySet = {
      manifestVersion: 1,
      files: [
        {
          ...sampleMemory.files[0]!,
          frontmatter: { ...sampleMemory.files[0]!.frontmatter, applies_to: ["other"] },
        },
        sampleMemory.files[1]!,
      ],
    };
    const { sections } = applyTokenBudget(restricted, sampleCtx, "my-adapter");
    expect(sections).toHaveLength(1);
    expect(sections[0]!.path).toBe("b.md");
  });
});
