import type { LintRule } from "../engine.js";

/**
 * Verifies that each file declared in `policy.lint.requiredSections`
 * contains every listed heading (exact match, case-sensitive).
 */
export const requiredSectionsRule: LintRule = {
  id: "required-sections",
  defaultLevel: "error",

  check(file, ctx) {
    const required = ctx.policy.lint.requiredSections[file.path];
    if (!required || required.length === 0) return [];

    const lines = file.body.split("\n");
    const headings = new Set<string>();
    for (const line of lines) {
      const m = /^(#{1,6})\s+(\S.*)$/.exec(line);
      if (m) headings.add(`${m[1]} ${m[2]!.trim()}`);
    }

    const findings: Array<{ line: number; message: string }> = [];
    for (const req of required) {
      if (!headings.has(req)) {
        findings.push({
          line: 1,
          message: `missing required section: ${req}`,
        });
      }
    }
    return findings;
  },
};
