import { z } from "zod";

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

export const ManifestFileEntry = z
  .object({
    path: z.string().min(1),
    source: SourceType,
    priority: z.number().int().min(0).max(100).default(50),
    applies_to: z.array(z.string().min(1)).default(["*"]),
  })
  .strict();
export type ManifestFileEntry = z.infer<typeof ManifestFileEntry>;

export const ManifestSchema = z
  .object({
    version: z.literal(1),
    project: z
      .object({
        name: z.string().min(1),
        description: z.string().optional(),
      })
      .strict(),
    targets: z.array(z.string().min(1)).min(1),
    files: z.array(ManifestFileEntry),
    generation: z
      .object({
        scanner: z.enum(["web-tree-sitter", "shape", "off"]).default("shape"),
        exclude: z.array(z.string().min(1)).default([]),
      })
      .strict()
      .default({ scanner: "shape", exclude: [] }),
  })
  .strict();
export type Manifest = z.infer<typeof ManifestSchema>;
