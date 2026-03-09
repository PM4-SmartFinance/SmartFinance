import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

export function errorHandler(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply,
): void {
  const statusCode = error.statusCode ?? 500;
  const isProduction = process.env["NODE_ENV"] === "production";

  void reply.status(statusCode).send({
    error: {
      statusCode,
      message: isProduction && statusCode >= 500 ? "Internal Server Error" : error.message,
    },
  });
}
