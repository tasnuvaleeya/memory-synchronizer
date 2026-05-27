import { createHash } from "node:crypto";
import type { MemorySet } from "../core/memory.js";

export interface GeneratedFile {
  path: string;
  contents: string;
  /** sha256 of contents after provenance strip */
  checksum: string;
  /** checksum of contributing /agent files */
  sourceSha: string;
}

export interface RenderContext {
  projectName: string;
  manifestVersion: number;
  tokenBudget: number | null;
  priorityOrder: string[];
  generatorVersion: string;
  /** ISO timestamp, frozen per run for determinism */
  now: string;
}

export interface Adapter {
  readonly name: string;
  readonly version: string;
  readonly outputPaths: string[];
  render(memory: MemorySet, ctx: RenderContext): Promise<GeneratedFile[]>;
  tokenBudget?(): number | null;
  supportsPartial?(): boolean;
  postProcess?(file: GeneratedFile): GeneratedFile;
}

/**
 * Apply token budget rules deterministically:
 * 1. Sort files by priority (low number = high priority).
 * 2. Accumulate content until budget is exhausted.
 * 3. Drop files tagged optional first.
 * 4. Truncate remaining if still over budget.
 *
 * Returns filtered/truncated MemorySet files as rendered markdown blocks.
 */
export function applyTokenBudget(
  memory: MemorySet,
  ctx: RenderContext,
  adapterName: string,
): { sections: Array<{ path: string; body: string }>; truncated: boolean } {
  const budget = ctx.tokenBudget;
  const prioritized = [...memory.files]
    .filter((f) => {
      const applies = f.frontmatter.applies_to;
      return applies.includes("*") || applies.includes(adapterName);
    })
    .sort((a, b) => a.frontmatter.priority - b.frontmatter.priority);

  if (!budget) {
    return {
      sections: prioritized.map((f) => ({ path: f.path, body: f.body })),
      truncated: false,
    };
  }

  const charBudget = budget * 4;
  let used = 0;
  const sections: Array<{ path: string; body: string }> = [];
  let truncated = false;

  for (const file of prioritized) {
    const isOptional = file.frontmatter.tags.includes("optional");
    const chars = file.body.length;

    if (used + chars <= charBudget) {
      sections.push({ path: file.path, body: file.body });
      used += chars;
    } else if (!isOptional) {
      const remaining = charBudget - used;
      if (remaining > 200) {
        const truncatedBody =
          file.body.slice(0, remaining) +
          `\n\n<!-- agentsync: truncated ${file.body.length - remaining} chars from ${file.path} -->`;
        sections.push({ path: file.path, body: truncatedBody });
      }
      used = charBudget;
      truncated = true;
    }
  }

  return { sections, truncated };
}

/**
 * Compute a combined source SHA from all contributing memory files.
 * Deterministic: sorted by path before hashing.
 */
export function computeSourceSha(memory: MemorySet): string {
  const sorted = [...memory.files].sort((a, b) => (a.path < b.path ? -1 : 1));
  const hash = createHash("sha256");
  for (const f of sorted) hash.update(f.sha);
  return hash.digest("hex");
}
