import type { LintRule } from "../engine.js";

const DEFAULT_MAX_AGE_DAYS = 90;

/**
 * Warns when a memory file hasn't been touched in `maxAgeDays`.
 * Uses on-disk mtime supplied via RuleContext (no fs access here).
 */
export const freshnessRule: LintRule = {
  id: "freshness",
  defaultLevel: "warn",

  check(_file, ctx) {
    const maxAgeDays = ctx.config.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS;
    const ageMs = Date.now() - ctx.mtimeMs;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays > maxAgeDays) {
      return [
        {
          line: 1,
          message: `unchanged for ${Math.floor(ageDays)} days (>${maxAgeDays}); review and refresh`,
        },
      ];
    }
    return [];
  },
};
