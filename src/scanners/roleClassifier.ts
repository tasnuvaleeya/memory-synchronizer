import type { FileRole } from "./types.js";

/**
 * Pure path → role classifier. Uses static heuristics per
 * features/feature-plan.md line 114. Tested in tests/scanners/roleClassifier.test.ts.
 */
export function classifyRole(filePath: string): FileRole {
  const p = filePath.replace(/\\/g, "/");

  // Test: any segment of `tests/` or `test/`, or `*.test.*` / `*.spec.*`
  if (/(^|\/)tests?\//.test(p) || /\.(test|spec)\.[^/]+$/.test(p)) {
    return "test";
  }

  // Config: dotfiles at root-ish, *.config.*, Dockerfile*, .github/**
  if (
    /(^|\/)Dockerfile[^/]*$/i.test(p) ||
    /(^|\/)\.github\//.test(p) ||
    /(^|\/)\.gitlab\//.test(p) ||
    /(^|\/)\.circleci\//.test(p) ||
    /\.config\.[^/]+$/.test(p) ||
    /(^|\/)docker-compose(\.[^/]+)?\.ya?ml$/i.test(p) ||
    /(^|\/)(package|tsconfig|pyproject|Cargo|go|composer)\.(json|toml|mod|lock)$/i.test(p) ||
    /(^|\/)\.(env|gitignore|dockerignore|editorconfig|prettierrc|eslintrc|nvmrc)/.test(p)
  ) {
    return "config";
  }

  // Doc: markdown files, LICENSE, README
  if (/\.(md|mdx)$/i.test(p) || /(^|\/)(README|LICENSE|CHANGELOG|CONTRIBUTING)(\.[^/]+)?$/i.test(p)) {
    return "doc";
  }

  // Entry: bin/**, main.*, index.* at package roots, *.bin
  if (/(^|\/)bin\//.test(p) || /(^|\/)main\.[^/]+$/.test(p)) {
    return "entry";
  }

  return "source";
}
