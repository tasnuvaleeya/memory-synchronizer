import { describe, it, expect } from "vitest";
import { versionCommand } from "../src/cli/version.js";
import { Logger } from "../src/core/logger.js";

class CapturingLogger extends Logger {
  public readonly stdout: string[] = [];
  constructor() {
    super({ quiet: true });
  }
  override print(msg: string): void {
    this.stdout.push(msg);
  }
}

describe("version command", () => {
  it("prints the version from package.json", async () => {
    const logger = new CapturingLogger();
    await versionCommand({}, logger);
    expect(logger.stdout[0]).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("supports --json output", async () => {
    const logger = new CapturingLogger();
    await versionCommand({ json: true }, logger);
    const parsed = JSON.parse(logger.stdout[0] ?? "") as { version: string };
    expect(parsed.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
