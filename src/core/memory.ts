import { z } from "zod";
import { FrontmatterSchema } from "./manifest.js";

export const MemoryFileSchema = z
  .object({
    path: z.string().min(1),
    frontmatter: FrontmatterSchema,
    body: z.string(),
    sha: z.string().length(64),
  })
  .strict();
export type MemoryFile = z.infer<typeof MemoryFileSchema>;

export const MemorySetSchema = z
  .object({
    manifestVersion: z.literal(1),
    files: z.array(MemoryFileSchema),
    scanArtifacts: z
      .object({
        repoMap: z.unknown().optional(),
        dependencyGraph: z.unknown().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type MemorySet = z.infer<typeof MemorySetSchema>;
