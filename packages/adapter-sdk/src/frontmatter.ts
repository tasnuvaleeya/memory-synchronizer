import { z } from "zod";

/** Authoring intent for a memory file: human-written, machine-generated, or hybrid. */
export const SourceType = z.enum(["authored", "generated", "hybrid"]);
export type SourceType = z.infer<typeof SourceType>;

export const FrontmatterSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().min(1),
    source: SourceType.default("authored"),
    priority: z.number().int().min(0).max(100).default(50),
    applies_to: z.array(z.string().min(1)).default(["*"]),
    tags: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type Frontmatter = z.infer<typeof FrontmatterSchema>;
