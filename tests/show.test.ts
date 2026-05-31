import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { initCommand } from "../src/cli/init.js";
import { showCommand } from "../src/cli/show.js";
import { Logger } from "../src/core/logger.js";
import { UserError } from "../src/core/errors.js";

let root: string;
const quiet = new Logger({ quiet: true });

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "agentctx-show-"));
  await initCommand(root, {}, quiet);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

class CapturingLogger extends Logger {
  public readonly stdout: string[] = [];
  constructor() {
    super({ quiet: true });
  }
  override print(msg: string): void {
    this.stdout.push(msg);
  }
}

describe("show command", () => {
  it("resolves a path relative to agent/ when not found at cwd", async () => {
    const logger = new CapturingLogger();
    await showCommand(root, "coding-rules.md", { json: true }, logger);
    const payload = JSON.parse(logger.stdout.join("\n")) as {
      path: string;
      frontmatter: { name: string };
    };
    expect(payload.path).toBe("agent/coding-rules.md");
    expect(payload.frontmatter.name).toBe("coding-rules");
  });

  it("throws UserError when the file does not exist", async () => {
    await expect(showCommand(root, "nope.md", {}, quiet)).rejects.toThrow(UserError);
  });

  it("throws UserError when the file lacks frontmatter", async () => {
    const { writeFile } = await import("node:fs/promises");
    const plain = path.join(root, "plain.md");
    await writeFile(plain, "# no frontmatter\n", "utf8");
    await expect(showCommand(root, "plain.md", {}, quiet)).rejects.toThrow(UserError);
  });
});
