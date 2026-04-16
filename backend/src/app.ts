import Fastify from "fastify";
import secureSession from "@fastify/secure-session";
import rateLimit from "@fastify/rate-limit";
import { errorHandler } from "./middleware/error-handler.js";
import { healthRoutes } from "./controllers/health.controller.js";
import { authRoutes } from "./controllers/auth.controller.js";
import { transactionRoutes } from "./controllers/transaction.controller.js";
import { setLogger } from "./logger.js";
import { budgetRoutes } from "./controllers/budget.controller.js";
import { userRoutes } from "./controllers/user.controller.js";
import { accountRoutes } from "./controllers/account.controller.js";
import { categoryRuleRoutes } from "./controllers/category-rule.controller.js";
import { dashboardRoutes } from "./controllers/dashboard.controller.js";
import { categoryRoutes } from "./controllers/category.controller.js";

export async function buildApp() {
  const app = Fastify({ logger: true });
  setLogger(app.log);

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

  // Global rate limiter — applies only to routes that explicitly opt in via
  // `config.rateLimit`. Auth-sensitive endpoints (POST /auth/login,
  // POST /users) set stricter per-route limits to mitigate brute-force and
  // argon2 CPU-exhaustion attacks as required by CLAUDE.md.
  //
  // Disabled in the test environment: integration tests legitimately hit
  // these endpoints many times per second via `app.inject`, which would
  // otherwise trip the limiter and produce false 429s.
  const isTest = process.env["NODE_ENV"] === "test" || process.env["VITEST"] !== undefined;
  if (!isTest) {
    await app.register(rateLimit, {
      global: false,
      max: 100,
      timeWindow: "1 minute",
    });
  }

  app.setErrorHandler(errorHandler);

  await app.register(healthRoutes, { prefix: "/api/v1" });
  await app.register(authRoutes, { prefix: "/api/v1" });
  await app.register(transactionRoutes, { prefix: "/api/v1" });
  await app.register(budgetRoutes, { prefix: "/api/v1" });
  await app.register(dashboardRoutes, { prefix: "/api/v1" });
  await app.register(userRoutes, { prefix: "/api/v1" });
  await app.register(accountRoutes, { prefix: "/api/v1" });
  await app.register(categoryRuleRoutes, { prefix: "/api/v1" });
  await app.register(categoryRoutes, { prefix: "/api/v1" });

  return app;
}
