# @agentctx/adapter-sdk

Public types and helpers for building [agentctx](https://github.com/tasnuvaleeya/memory-synchronizer) adapters and SDK consumers.

## Install

```sh
npm install @agentctx/adapter-sdk
```

## Use

Write a custom adapter for a tool agentctx doesn't ship out of the box:

```ts
import {
  type Adapter,
  type GeneratedFile,
  applyTokenBudget,
  computeSourceSha,
  injectProvenance,
  contentChecksum,
} from "@agentctx/adapter-sdk";

export const aiderAdapter: Adapter = {
  name: "aider",
  version: "0.1.0",
  outputPaths: [".aider.conf.yml"],

  async render(memory, ctx): Promise<GeneratedFile[]> {
    const { sections } = applyTokenBudget(memory, ctx, "aider");
    const body = sections.map((s) => s.body).join("\n\n");
    const sourceSha = computeSourceSha(memory);
    const contents = injectProvenance(body, {
      sourceSha,
      generator: `aider-adapter@0.1.0`,
      generatedAt: ctx.now,
    });
    return [
      {
        path: ".aider.conf.yml",
        contents,
        checksum: contentChecksum(contents),
        sourceSha,
      },
    ];
  },
};
```

## Exported surface

| Name | Purpose |
|---|---|
| `Adapter`, `GeneratedFile`, `RenderContext` | Core adapter interface and supporting types |
| `MemoryFile`, `MemorySet` | Inputs to your `render()` |
| `Frontmatter`, `SourceType`, `FrontmatterSchema` | Memory file frontmatter shape |
| `MemoryFileSchema`, `MemorySetSchema` | Zod schemas for validation |
| `injectProvenance`, `stripProvenance`, `parseProvenance`, `buildProvenanceHeader`, `contentChecksum` | Provenance header helpers — mandatory for any generated file |
| `applyTokenBudget`, `computeSourceSha` | Deterministic helpers shared with built-in adapters |

## License

MIT
