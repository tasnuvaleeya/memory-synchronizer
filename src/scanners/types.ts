import { z } from "zod";

export const FileRoleSchema = z.enum(["entry", "test", "config", "doc", "source"]);
export type FileRole = z.infer<typeof FileRoleSchema>;

export const FileFactSchema = z
  .object({
    path: z.string().min(1),
    role: FileRoleSchema,
    language: z.string().nullable(),
    lineCount: z.number().int().nonnegative(),
    sha: z.string().length(64),
  })
  .strict();
export type FileFact = z.infer<typeof FileFactSchema>;

export const LanguageSummarySchema = z
  .object({
    language: z.string(),
    files: z.number().int().nonnegative(),
    lines: z.number().int().nonnegative(),
  })
  .strict();
export type LanguageSummary = z.infer<typeof LanguageSummarySchema>;

export interface TreeNode {
  name: string;
  path: string;
  type: "dir" | "file";
  children?: TreeNode[] | undefined;
  lineCount?: number | undefined;
  language?: string | null | undefined;
  role?: FileRole | undefined;
}

export const TreeNodeSchema: z.ZodType<TreeNode> = z.lazy(() =>
  z
    .object({
      name: z.string(),
      path: z.string(),
      type: z.enum(["dir", "file"]),
      children: z.array(TreeNodeSchema).optional(),
      lineCount: z.number().int().nonnegative().optional(),
      language: z.string().nullable().optional(),
      role: FileRoleSchema.optional(),
    })
    .strict(),
);

export const RepoMapSchema = z
  .object({
    version: z.literal(1),
    summary: z
      .object({
        totalFiles: z.number().int().nonnegative(),
        totalLines: z.number().int().nonnegative(),
        languages: z.array(LanguageSummarySchema),
      })
      .strict(),
    tree: TreeNodeSchema,
    files: z.array(FileFactSchema),
  })
  .strict();
export type RepoMap = z.infer<typeof RepoMapSchema>;

export const StackSchema = z
  .object({
    languages: z.array(z.string()),
    runtimes: z.array(z.string()),
    packageManagers: z.array(z.string()),
    frameworks: z.array(z.string()),
    ci: z.array(z.string()),
  })
  .strict();
export type Stack = z.infer<typeof StackSchema>;

export interface ScanResult {
  repoMap: RepoMap;
  stack: Stack;
}
