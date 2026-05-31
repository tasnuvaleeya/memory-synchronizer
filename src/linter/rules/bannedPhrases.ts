import type { LintRule } from "../engine.js";

const DEFAULT_BANNED = ["TODO", "TBD", "to be determined", "lorem ipsum", "fill in"];

/**
 * Flags vague placeholder phrases that signal incomplete agent context.
 * Configurable via `policy.lint.rules["banned-vague-phrases"].extra`.
 */
export const bannedPhrasesRule: LintRule = {
  id: "banned-vague-phrases",
  defaultLevel: "warn",

  check(file, ctx) {
    const extra = ctx.config.extra ?? [];
    const banned = [...DEFAULT_BANNED, ...extra];
    const findings: Array<{ line: number; message: string }> = [];
    const lines = file.body.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      for (const phrase of banned) {
        // Word-boundary match for ASCII phrases; case-insensitive
        const re = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "i");
        if (re.test(line)) {
          findings.push({
            line: i + 1,
            message: `contains banned phrase: "${phrase}"`,
          });
          break;
        }
      }
    }
    return findings;
  },
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
