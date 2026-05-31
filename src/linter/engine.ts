import type { MemoryFile } from "../core/memory.js";
import type { Policy, RuleLevel } from "../core/policy.js";

export interface LintFinding {
  ruleId: string;
  level: "warn" | "error";
  path: string;
  line: number;
  message: string;
  /** Optional auto-fix that replaces `range` in the file body with `replacement`. */
  fix?: { range: [number, number]; replacement: string } | undefined;
}

export interface RuleContext {
  policy: Policy;
  /** Per-rule config from policy (defaults to {}). */
  config: NonNullable<Policy["lint"]["rules"]>[string] | Record<string, never>;
  /** mtimeMs of the on-disk file, for freshness checks. */
  mtimeMs: number;
}

export interface LintRule {
  readonly id: string;
  readonly defaultLevel: RuleLevel;
  check(file: MemoryFile, ctx: RuleContext): Array<Omit<LintFinding, "level" | "ruleId" | "path">>;
  /** Optional auto-fix that returns the transformed body. */
  fix?(file: MemoryFile, ctx: RuleContext): string | null;
}

export function effectiveLevel(rule: LintRule, policy: Policy): RuleLevel {
  return policy.lint.rules[rule.id]?.level ?? rule.defaultLevel;
}

export interface RunOpts {
  rules: LintRule[];
  policy: Policy;
  /** Per-file mtime lookup (path → mtimeMs). Used for freshness. */
  mtimes: Map<string, number>;
}

export function runLinter(files: MemoryFile[], opts: RunOpts): LintFinding[] {
  const findings: LintFinding[] = [];

  for (const file of files) {
    for (const rule of opts.rules) {
      const level = effectiveLevel(rule, opts.policy);
      if (level === "off") continue;

      const ctx: RuleContext = {
        policy: opts.policy,
        config: opts.policy.lint.rules[rule.id] ?? {},
        mtimeMs: opts.mtimes.get(file.path) ?? Date.now(),
      };

      const raw = rule.check(file, ctx);
      for (const r of raw) {
        const finding: LintFinding = {
          ruleId: rule.id,
          level,
          path: file.path,
          line: r.line,
          message: r.message,
          fix: r.fix,
        };
        findings.push(finding);
      }
    }
  }

  // Deterministic ordering: by path, then line, then ruleId
  findings.sort((a, b) => {
    if (a.path !== b.path) return a.path < b.path ? -1 : 1;
    if (a.line !== b.line) return a.line - b.line;
    return a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0;
  });

  return findings;
}
