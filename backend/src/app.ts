import Fastify from "fastify";
import secureSession from "@fastify/secure-session";
import { errorHandler } from "./middleware/error-handler.js";
import { healthRoutes } from "./controllers/health.controller.js";
import { authRoutes } from "./controllers/auth.controller.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  const sessionSecret = process.env["SESSION_SECRET"] ?? "";
  if (process.env["NODE_ENV"] === "production" && sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters in production");
  }
  const finalSecret =
    sessionSecret.length >= 32 ? sessionSecret : "dev_secret_do_not_use_in_prod_32";

  await app.register(secureSession, {
    key: Buffer.from(finalSecret).subarray(0, 32),
    cookie: {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env["NODE_ENV"] === "production",
    },
  });

  app.setErrorHandler(errorHandler);

  await app.register(healthRoutes, { prefix: "/api/v1" });
  await app.register(authRoutes, { prefix: "/api/v1" });

  return app;
}
