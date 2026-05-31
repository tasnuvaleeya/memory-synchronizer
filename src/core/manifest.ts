import { z } from "zod";
import { SourceType, FrontmatterSchema, type Frontmatter } from "@agentsync/adapter-sdk";

// Re-export the SDK-canonical authoring types so internal imports of this
// module keep working without a churn-y mass rename.
export { SourceType, FrontmatterSchema, type Frontmatter };

// ManifestFileEntry / ManifestSchema describe the on-disk `agent/manifest.yaml`
// format. They are CLI-internal — not part of the public adapter SDK surface —
// because adapter authors only need the MemorySet/Frontmatter types.

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
