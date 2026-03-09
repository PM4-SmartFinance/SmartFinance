import Fastify from "fastify";
import { errorHandler } from "./middleware/error-handler.js";
import { healthRoutes } from "./controllers/health.controller.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  app.setErrorHandler(errorHandler);

  await app.register(healthRoutes, { prefix: "/api/v1" });

  return app;
}
