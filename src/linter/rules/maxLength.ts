import type { LintRule } from "../engine.js";

const DEFAULT_MAX_BODY_CHARS = 20000;

/**
 * Warns when a memory file's body exceeds `maxBodyChars`.
 * Long memory files dilute downstream adapter prompts and usually mean
 * the file should be split.
 */
export const maxLengthRule: LintRule = {
  id: "max-length",
  defaultLevel: "warn",

  check(file, ctx) {
    const maxBodyChars = ctx.config.maxBodyChars ?? DEFAULT_MAX_BODY_CHARS;
    if (file.body.length > maxBodyChars) {
      return [
        {
          line: 1,
          message: `body length ${file.body.length} exceeds ${maxBodyChars} chars; consider splitting`,
        },
      ];
    }
    return [];
  },
};
