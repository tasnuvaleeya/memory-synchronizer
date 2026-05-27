import { sha256 } from "../core/paths.js";
import { injectProvenance, contentChecksum } from "../core/provenance.js";
import { applyTokenBudget, computeSourceSha } from "./base.js";
import type { GeneratedFile, RenderContext } from "./base.js";
import type { MemorySet } from "../core/memory.js";

export interface RenderOpts {
  adapterName: string;
  adapterVersion: string;
  outputPath: string;
  memory: MemorySet;
  ctx: RenderContext;
  /** Build the body content from the filtered sections */
  buildBody(sections: Array<{ path: string; body: string }>, truncated: boolean): string;
}

export function renderFile(opts: RenderOpts): GeneratedFile {
  const { adapterName, adapterVersion, outputPath, memory, ctx, buildBody } = opts;
  const sourceSha = computeSourceSha(memory);
  const { sections, truncated } = applyTokenBudget(memory, ctx, adapterName);
  const body = buildBody(sections, truncated);
  const withProvenance = injectProvenance(body, {
    sourceSha,
    generator: `${adapterName}-adapter@${adapterVersion}`,
    generatedAt: ctx.now,
  });
  return {
    path: outputPath,
    contents: withProvenance,
    checksum: sha256(body),
    sourceSha,
  };
}

export function buildStandardBody(
  sections: Array<{ path: string; body: string }>,
  truncated: boolean,
  header: string,
): string {
  const parts = [header, ""];
  for (const s of sections) {
    parts.push(s.body.trim());
    parts.push("");
  }
  if (truncated) {
    parts.push("---");
    parts.push("*Some sections were omitted due to token budget limits.*");
    parts.push("");
  }
  return parts.join("\n");
}

/** sha256 is re-exported here for adapters that need it without importing paths */
export { sha256, contentChecksum };
