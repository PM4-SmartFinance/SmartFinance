export class ServiceError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "ServiceError";
    this.statusCode = statusCode;
  }
}

export class DuplicateRuleError extends Error {
  constructor(message = "A rule with this pattern and match type already exists") {
    super(message);
    this.name = "DuplicateRuleError";
  }
}
