export type ExitCode = 0 | 1 | 2 | 3;

export class AgentctxError extends Error {
  public readonly exitCode: ExitCode;

  constructor(message: string, exitCode: ExitCode = 1) {
    super(message);
    this.name = "AgentctxError";
    this.exitCode = exitCode;
  }
}

export class UserError extends AgentctxError {
  constructor(message: string) {
    super(message, 1);
    this.name = "UserError";
  }
}

export class DriftError extends AgentctxError {
  constructor(message: string) {
    super(message, 2);
    this.name = "DriftError";
  }
}

export class InternalError extends AgentctxError {
  constructor(message: string) {
    super(message, 3);
    this.name = "InternalError";
  }
}
