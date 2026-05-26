import pc from "picocolors";
import symbols from "log-symbols";

export interface LoggerOptions {
  quiet?: boolean;
  verbose?: boolean;
  color?: boolean;
}

export class Logger {
  private quiet: boolean;
  private verbose: boolean;

  constructor(opts: LoggerOptions = {}) {
    this.quiet = opts.quiet ?? false;
    this.verbose = opts.verbose ?? false;
    if (opts.color === false) {
      // picocolors auto-detects; we re-export raw strings when color is off.
      // Honoring NO_COLOR / --no-color happens at CLI entry.
    }
  }

  info(msg: string): void {
    if (this.quiet) return;
    process.stderr.write(`${symbols.info} ${msg}\n`);
  }

  success(msg: string): void {
    if (this.quiet) return;
    process.stderr.write(`${symbols.success} ${pc.green(msg)}\n`);
  }

  warn(msg: string): void {
    if (this.quiet) return;
    process.stderr.write(`${symbols.warning} ${pc.yellow(msg)}\n`);
  }

  error(msg: string): void {
    process.stderr.write(`${symbols.error} ${pc.red(msg)}\n`);
  }

  debug(msg: string): void {
    if (!this.verbose) return;
    process.stderr.write(`${pc.dim("[debug]")} ${msg}\n`);
  }

  /** Print structured/result output to stdout (machine-readable in --json). */
  print(msg: string): void {
    process.stdout.write(`${msg}\n`);
  }
}

export const colors = pc;
