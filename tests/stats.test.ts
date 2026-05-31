import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { initCommand } from "../src/cli/init.js";
import { statsCommand } from "../src/cli/stats.js";
import { syncCommand } from "../src/cli/sync.js";
import { Logger } from "../src/core/logger.js";

let root: string;
const quiet = new Logger({ quiet: true });

class Capturing extends Logger {
  public readonly stdout: string[] = [];
  constructor() {
    super({ quiet: true });
  }
  override print(msg: string): void {
    this.stdout.push(msg);
  }
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "agentctx-stats-"));
  await initCommand(root, {}, quiet);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("stats command", () => {
  it("--json reports per-file and per-adapter token counts", async () => {
    const logger = new Capturing();
    await statsCommand(root, { json: true }, logger);
    const payload = JSON.parse(logger.stdout.join("\n")) as {
      files: Array<{ path: string; chars: number; estimatedTokens: number }>;
      adapters: Array<{ adapter: string; estimatedTokens: number; driftStatus: string }>;
      totals: { files: number };
    };
    expect(payload.files.length).toBeGreaterThan(0);
    expect(payload.adapters.length).toBeGreaterThan(0);
    expect(payload.adapters.every((a) => typeof a.estimatedTokens === "number")).toBe(true);
    expect(payload.totals.files).toBe(payload.files.length);
  });

  it("reports clean drift status after sync", async () => {
    await syncCommand(root, { adapter: ["claude"] }, quiet);
    const logger = new Capturing();
    await statsCommand(root, { json: true }, logger);
    const payload = JSON.parse(logger.stdout.join("\n")) as {
      adapters: Array<{ adapter: string; driftStatus: string }>;
    };
    const claude = payload.adapters.find((a) => a.adapter === "claude");
    expect(claude?.driftStatus).toBe("clean");
  });

  it("reports missing drift status before any sync", async () => {
    const logger = new Capturing();
    await statsCommand(root, { json: true }, logger);
    const payload = JSON.parse(logger.stdout.join("\n")) as {
      adapters: Array<{ adapter: string; driftStatus: string }>;
    };
    expect(payload.adapters.every((a) => a.driftStatus === "missing")).toBe(true);
  });
});
