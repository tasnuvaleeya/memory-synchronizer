import { describe, it, expect } from "vitest";
import { classifyRole } from "../../src/scanners/roleClassifier.js";

describe("classifyRole", () => {
  const cases: Array<[string, ReturnType<typeof classifyRole>]> = [
    ["src/foo.ts", "source"],
    ["tests/foo.test.ts", "test"],
    ["test/foo.spec.js", "test"],
    ["src/foo.test.ts", "test"],
    ["src/foo.spec.tsx", "test"],
    ["Dockerfile", "config"],
    ["Dockerfile.prod", "config"],
    ["docker-compose.yml", "config"],
    [".github/workflows/ci.yml", "config"],
    [".gitignore", "config"],
    ["package.json", "config"],
    ["tsconfig.json", "config"],
    ["vite.config.ts", "config"],
    ["pyproject.toml", "config"],
    ["Cargo.toml", "config"],
    ["go.mod", "config"],
    ["README.md", "doc"],
    ["docs/setup.md", "doc"],
    ["LICENSE", "doc"],
    ["bin/agentsync.js", "entry"],
    ["src/main.ts", "entry"],
    ["src/components/Button.tsx", "source"],
  ];

  for (const [path, expected] of cases) {
    it(`classifies ${path} as ${expected}`, () => {
      expect(classifyRole(path)).toBe(expected);
    });
  }
});
