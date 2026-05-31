import * as core from "@actions/core";
import { spawn } from "node:child_process";
import path from "node:path";

interface CommandSpec {
  args: string[];
  /** which step this is, for output formatting. */
  label: string;
}

interface RunResult {
  stdout: string;
  stderr: string;
  code: number;
}

interface LintFinding {
  ruleId: string;
  level: "warn" | "error";
  path: string;
  line: number;
  message: string;
}

async function main(): Promise<void> {
  const commandsInput = core.getInput("command") || "sync --check,lint";
  const policy = core.getInput("policy");
  const workingDir = core.getInput("working-directory") || ".";
  const failOnWarning = core.getInput("fail-on-warning") === "true";

  const cwd = path.resolve(workingDir);
  const specs: CommandSpec[] = commandsInput.split(",").map((c) => {
    const parts = c.trim().split(/\s+/);
    const args = [...parts];
    if (policy) args.push("--policy", policy);
    args.push("--json");
    return { args, label: parts[0] ?? "agentsync" };
  });

  let drifted = false;
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const spec of specs) {
    core.startGroup(`agentsync ${spec.args.join(" ")}`);
    const result = await run(spec.args, cwd);
    process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);

    if (spec.label === "sync" && result.code === 2) {
      drifted = true;
      core.error(`agentsync sync --check detected drift. Run \`agentsync sync\` locally.`);
    }

    if (spec.label === "lint") {
      const { errors, warnings } = parseLintOutput(result.stdout);
      totalErrors += errors.length;
      totalWarnings += warnings.length;
      annotateLint(errors, "error");
      annotateLint(warnings, "warning");
    }
    core.endGroup();
  }

  core.setOutput("drifted", drifted ? "true" : "false");
  core.setOutput("lint-errors", String(totalErrors));
  core.setOutput("lint-warnings", String(totalWarnings));

  if (drifted) {
    core.setFailed(`agentsync drift detected`);
    return;
  }
  if (totalErrors > 0) {
    core.setFailed(`agentsync lint: ${totalErrors} error(s)`);
    return;
  }
  if (failOnWarning && totalWarnings > 0) {
    core.setFailed(`agentsync lint: ${totalWarnings} warning(s) with fail-on-warning enabled`);
  }
}

function run(args: string[], cwd: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const proc = spawn("npx", ["-y", "@agentsync/cli", ...args], { cwd });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    proc.on("close", (code: number | null) => {
      resolve({ stdout, stderr, code: code ?? 0 });
    });
  });
}

interface LintJsonOut {
  errors?: LintFinding[];
  warnings?: LintFinding[];
}

function parseLintOutput(stdout: string): { errors: LintFinding[]; warnings: LintFinding[] } {
  try {
    const parsed = JSON.parse(stdout) as LintJsonOut;
    return {
      errors: parsed.errors ?? [],
      warnings: parsed.warnings ?? [],
    };
  } catch {
    return { errors: [], warnings: [] };
  }
}

export function annotateLint(findings: LintFinding[], severity: "error" | "warning"): void {
  for (const f of findings) {
    const props = { file: f.path, startLine: f.line, title: f.ruleId };
    if (severity === "error") core.error(f.message, props);
    else core.warning(f.message, props);
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  core.setFailed(`agentsync action failed: ${msg}`);
});
