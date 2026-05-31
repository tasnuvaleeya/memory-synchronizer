import { z } from "zod";
import { FrontmatterSchema } from "./frontmatter.js";

/** A parsed memory file: frontmatter + body + content sha. */
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

/** One file produced by an adapter, with checksums for drift tracking. */
export interface GeneratedFile {
  path: string;
  contents: string;
  /** sha256 of contents after provenance strip */
  checksum: string;
  /** sha of contributing /agent files */
  sourceSha: string;
}

/** Per-run context handed to every adapter. Timestamp is frozen for determinism. */
export interface RenderContext {
  projectName: string;
  manifestVersion: number;
  tokenBudget: number | null;
  /** memory file paths sorted high → low priority */
  priorityOrder: string[];
  generatorVersion: string;
  /** ISO timestamp, frozen per run */
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
