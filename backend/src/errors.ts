export class ServiceError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "ServiceError";
    this.statusCode = statusCode;
  }
}
