import type { FastifyBaseLogger } from "fastify";

let logger: FastifyBaseLogger | undefined;

export function setLogger(instance: FastifyBaseLogger) {
  logger = instance;
}

export function getLogger(): FastifyBaseLogger {
  if (!logger) {
    throw new Error("Logger not initialized — call setLogger(app.log) during startup");
  }
  return logger;
}
