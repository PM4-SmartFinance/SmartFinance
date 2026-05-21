export class ServiceError extends Error {
  statusCode: number;
  details?: Record<string, unknown> | undefined;

  constructor(statusCode: number, message: string, details?: Record<string, unknown> | undefined) {
    super(message);
    this.name = "ServiceError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class DuplicateRuleError extends Error {
  constructor(message = "A rule with this pattern and match type already exists") {
    super(message);
    this.name = "DuplicateRuleError";
  }
}

export class EmailConflictError extends Error {
  constructor() {
    super("Email already in use");
    this.name = "EmailConflictError";
  }
}
