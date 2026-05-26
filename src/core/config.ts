import { z } from "zod";

export const ConfigSchema = z
  .object({
    defaultAdapters: z.array(z.string().min(1)).default(["claude", "agents-md"]),
    tokenBudgets: z.record(z.string(), z.number().int().positive()).default({}),
    plugins: z
      .object({
        adapters: z.array(z.string().min(1)).default([]),
        scanners: z.array(z.string().min(1)).default([]),
        lintRules: z.array(z.string().min(1)).default([]),
      })
      .strict()
      .default({ adapters: [], scanners: [], lintRules: [] }),
  })
  .strict();
export type Config = z.infer<typeof ConfigSchema>;

export const DEFAULT_CONFIG: Config = ConfigSchema.parse({});
