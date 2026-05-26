export type ExitCode = 0 | 1 | 2 | 3;

export class AgentsyncError extends Error {
  public readonly exitCode: ExitCode;

  constructor(message: string, exitCode: ExitCode = 1) {
    super(message);
    this.name = "AgentsyncError";
    this.exitCode = exitCode;
  }
}

export class UserError extends AgentsyncError {
  constructor(message: string) {
    super(message, 1);
    this.name = "UserError";
  }
}

export class DriftError extends AgentsyncError {
  constructor(message: string) {
    super(message, 2);
    this.name = "DriftError";
  }
}

export class InternalError extends AgentsyncError {
  constructor(message: string) {
    super(message, 3);
    this.name = "InternalError";
  }
}
