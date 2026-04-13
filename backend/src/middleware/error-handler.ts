import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ServiceError } from "../errors.js";

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const statusCode = error instanceof ServiceError ? error.statusCode : (error.statusCode ?? 500);
  const isProduction = process.env["NODE_ENV"] === "production";

  if (statusCode >= 500) {
    request.log.error({ err: error }, "Unhandled server error");
  }

  void reply.status(statusCode).send({
    error: {
      statusCode,
      message: isProduction && statusCode >= 500 ? "Internal Server Error" : error.message,
    },
  });
}
