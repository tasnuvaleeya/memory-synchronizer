import type { LintRule } from "../engine.js";

/**
 * Flags skips in markdown heading levels (e.g., h1 → h3 with no h2).
 */
export const headingHierarchyRule: LintRule = {
  id: "heading-hierarchy",
  defaultLevel: "warn",

  check(file) {
    const findings: Array<{ line: number; message: string }> = [];
    const lines = file.body.split("\n");
    let lastLevel = 0;

    for (let i = 0; i < lines.length; i++) {
      const m = /^(#{1,6})\s+\S/.exec(lines[i]!);
      if (!m) continue;
      const level = m[1]!.length;

      if (lastLevel === 0 && level > 1) {
        findings.push({
          line: i + 1,
          message: `first heading is level ${level}, expected h1`,
        });
      } else if (level > lastLevel + 1) {
        findings.push({
          line: i + 1,
          message: `heading jumps from h${lastLevel} to h${level}`,
        });
      }
      lastLevel = level;
    }
    return findings;
  },
};
