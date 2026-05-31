import { z } from "zod";
import yaml from "js-yaml";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { UserError } from "./errors.js";

export const RuleLevel = z.enum(["off", "warn", "error"]);
export type RuleLevel = z.infer<typeof RuleLevel>;

const LintRuleConfig = z
  .object({
    level: RuleLevel.optional(),
    extra: z.array(z.string().min(1)).optional(),
    maxAgeDays: z.number().int().positive().optional(),
    maxBodyChars: z.number().int().positive().optional(),
  })
  .strict();
export type LintRuleConfig = z.infer<typeof LintRuleConfig>;

export const PolicySchema = z
  .object({
    version: z.literal(1),
    requiredFiles: z.array(z.string().min(1)).default([]),
    requiredAdapters: z.array(z.string().min(1)).default([]),
    lint: z
      .object({
        rules: z.record(z.string().min(1), LintRuleConfig).default({}),
        requiredSections: z
          .record(z.string().min(1), z.array(z.string().min(1)))
          .default({}),
      })
      .strict()
      .default({ rules: {}, requiredSections: {} }),
    tokenBudgets: z.record(z.string().min(1), z.number().int().positive()).default({}),
  })
  .strict();
export type Policy = z.infer<typeof PolicySchema>;

export const DEFAULT_POLICY: Policy = PolicySchema.parse({ version: 1 });

const POLICY_FILENAME = "agentsync.policy.yaml";

/**
 * Load a policy file. Resolution order:
 *   1. explicit path passed via `--policy <path>`
 *   2. agentsync.policy.yaml at repo root
 *   3. defaults (empty policy)
 *
 * Throws UserError if an explicit path was given but missing/invalid.
 */
export async function loadPolicy(
  cwd: string,
  explicit: string | undefined,
): Promise<Policy> {
  let target: string | null = null;
  let isExplicit = false;

  if (explicit) {
    target = path.isAbsolute(explicit) ? explicit : path.join(cwd, explicit);
    isExplicit = true;
    if (!existsSync(target)) {
      throw new UserError(`Policy file not found: ${target}`);
    }
  } else {
    const candidate = path.join(cwd, POLICY_FILENAME);
    if (existsSync(candidate)) target = candidate;
  }

  if (!target) return DEFAULT_POLICY;

  let raw: string;
  try {
    raw = await readFile(target, "utf8");
  } catch (err) {
    if (isExplicit) throw err;
    return DEFAULT_POLICY;
  }

  const loaded = yaml.load(raw, { filename: target }) ?? {};
  const parsed = PolicySchema.safeParse(loaded);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new UserError(`${target}: invalid policy\n${issues}`);
  }
  return parsed.data;
}
