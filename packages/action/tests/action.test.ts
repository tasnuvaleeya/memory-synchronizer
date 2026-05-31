import { describe, it, expect, vi } from "vitest";

// Mock @actions/core before importing the module under test.
const errorSpy = vi.fn();
const warningSpy = vi.fn();
vi.mock("@actions/core", () => ({
  error: errorSpy,
  warning: warningSpy,
  getInput: () => "",
  setOutput: vi.fn(),
  setFailed: vi.fn(),
  startGroup: vi.fn(),
  endGroup: vi.fn(),
}));

import { annotateLint } from "../src/index.js";

describe("annotateLint", () => {
  it("emits one core.error per error finding with file+startLine props", () => {
    errorSpy.mockClear();
    annotateLint(
      [
        {
          ruleId: "banned-vague-phrases",
          level: "error",
          path: "agent/coding-rules.md",
          line: 12,
          message: "contains banned phrase",
        },
      ],
      "error",
    );
    expect(errorSpy).toHaveBeenCalledOnce();
    const args = errorSpy.mock.calls[0]!;
    expect(args[0]).toBe("contains banned phrase");
    expect(args[1]).toMatchObject({
      file: "agent/coding-rules.md",
      startLine: 12,
      title: "banned-vague-phrases",
    });
  });

  it("emits core.warning for warning findings", () => {
    warningSpy.mockClear();
    annotateLint(
      [
        {
          ruleId: "freshness",
          level: "warn",
          path: "agent/architecture.md",
          line: 1,
          message: "old",
        },
      ],
      "warning",
    );
    expect(warningSpy).toHaveBeenCalledOnce();
  });
});
