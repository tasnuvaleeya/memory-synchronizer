import { createHash } from "node:crypto";
import type { MemorySet, RenderContext } from "./types.js";

/**
 * Apply token budget rules deterministically:
 *   1. Filter files by applies_to (must include "*" or this adapter's name)
 *   2. Sort by priority ascending (low number = high priority)
 *   3. Accumulate content until char budget (tokens * 4) is exhausted
 *   4. Drop "optional"-tagged sections first when over budget
 *   5. Truncate the next-lowest priority section instead of dropping wholesale
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
