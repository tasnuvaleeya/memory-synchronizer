import type { LintRule } from "../engine.js";
import { headingHierarchyRule } from "./headingHierarchy.js";
import { bannedPhrasesRule } from "./bannedPhrases.js";
import { requiredSectionsRule } from "./requiredSections.js";
import { freshnessRule } from "./freshness.js";
import { maxLengthRule } from "./maxLength.js";

export const BUILTIN_RULES: LintRule[] = [
  headingHierarchyRule,
  bannedPhrasesRule,
  requiredSectionsRule,
  freshnessRule,
  maxLengthRule,
];

export {
  headingHierarchyRule,
  bannedPhrasesRule,
  requiredSectionsRule,
  freshnessRule,
  maxLengthRule,
};
