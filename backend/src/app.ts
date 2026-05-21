import Fastify from "fastify";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import secureSession from "@fastify/secure-session";
import rateLimit from "@fastify/rate-limit";
import fastifyMetricsModule from "fastify-metrics";
import type { IMetricsPluginOptions } from "fastify-metrics";
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
import { auditRoutes } from "./controllers/audit.controller.js";
import { moduleRoutes } from "./controllers/modules.controller.js";
import { registerModule, clearRegistry } from "./services/module-registry.service.js";
import { registerImporter, clearImporterRegistry } from "./services/importer-registry.service.js";
import { registerNavItem, clearNavItemRegistry } from "./services/nav-item-registry.service.js";
import { registerWidget, clearWidgetRegistry } from "./services/widget-registry.service.js";
import { createStorageAdapter } from "./repositories/module-storage.repository.js";
import { ACTIVE_MODULES, type ModuleFactory } from "./modules/index.js";
import type {
  ImporterPlugin,
  NavItemDescriptor,
  RouteRegistrar,
  WidgetDescriptor,
} from "./types/module.js";

export interface BuildAppOptions {
  /** Register the rate limiter even under NODE_ENV=test / VITEST. */
  forceRateLimit?: boolean;
  /**
   * Override the modules used during bootstrap. Used by integration tests to
   * exercise the `MODULE_ID_RE` skip path, init-failure isolation, and other
   * lifecycle edge cases without modifying `ACTIVE_MODULES`.
   */
  modules?: ModuleFactory[];
}

type RouteMethod = keyof RouteRegistrar;
type DeferredCall = { method: RouteMethod; args: unknown[] };

/**
 * Two-phase init: collect a module's route registrations into a buffer so
 * routes are only mounted on Fastify after `init()` returns successfully.
 * A module that throws mid-init leaves no orphaned routes behind.
 */
function createDeferredRegistrar(): {
  registrar: RouteRegistrar;
  replay: (target: FastifyInstance) => void;
} {
  const calls: DeferredCall[] = [];
  const buffer = (method: RouteMethod) =>
    function deferred(...args: unknown[]): unknown {
      calls.push({ method, args });
      return undefined;
    };
  const registrar = {
    get: buffer("get"),
    post: buffer("post"),
    put: buffer("put"),
    patch: buffer("patch"),
    delete: buffer("delete"),
    head: buffer("head"),
    options: buffer("options"),
  } as unknown as RouteRegistrar;
  const replay = (target: FastifyInstance) => {
    for (const call of calls) {
      const method = target[call.method] as (...args: unknown[]) => unknown;
      method.apply(target, call.args);
    }
  };
  return { registrar, replay };
}

// fastify-metrics is published as CJS with `exports.default = plugin`. Under
// NodeNext ESM resolution the default import resolves to the module namespace
// rather than the inner default, so we unwrap it explicitly.
const fastifyMetrics = ((fastifyMetricsModule as unknown as { default?: unknown }).default ??
  fastifyMetricsModule) as FastifyPluginAsync<Partial<IMetricsPluginOptions>>;

export async function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({ logger: true });
  setLogger(app.log);

  const sessionSecret = process.env["SESSION_SECRET"] ?? "";
  if (process.env["NODE_ENV"] === "production" && sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters in production");
  }
  const finalSecret =
    sessionSecret.length >= 32 ? sessionSecret : "dev_secret_do_not_use_in_prod_32";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await app.register(secureSession as any, {
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
  if (!isTest || options.forceRateLimit) {
    await app.register(rateLimit, {
      global: false,
      max: 100,
      timeWindow: "1 minute",
    });
  }

  app.setErrorHandler(errorHandler);

  await app.register(fastifyMetrics, {
    endpoint: "/metrics",
    routeMetrics: {
      enabled: true,
      groupStatusCodes: true,
    },
  });

  await app.register(healthRoutes, { prefix: "/api/v1" });
  await app.register(authRoutes, { prefix: "/api/v1" });
  await app.register(transactionRoutes, { prefix: "/api/v1" });
  await app.register(budgetRoutes, { prefix: "/api/v1" });
  await app.register(dashboardRoutes, { prefix: "/api/v1" });
  await app.register(userRoutes, { prefix: "/api/v1" });
  await app.register(accountRoutes, { prefix: "/api/v1" });
  await app.register(categoryRuleRoutes, { prefix: "/api/v1" });
  await app.register(categoryRoutes, { prefix: "/api/v1" });
  await app.register(auditRoutes, { prefix: "/api/v1" });

  // Reset all module singletons so multiple buildApp() calls (e.g. across test
  // files) start with a clean slate and don't see stale or duplicate registrations.
  clearRegistry();
  clearImporterRegistry();
  clearNavItemRegistry();
  clearWidgetRegistry();

  const MODULE_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
  const modulesToBoot = options.modules ?? ACTIVE_MODULES;
  for (const factory of modulesToBoot) {
    const mod = factory();
    if (!MODULE_ID_RE.test(mod.id)) {
      app.log.error(
        { moduleId: mod.id },
        "module skipped — id must match /^[a-z0-9][a-z0-9-]{0,63}$/",
      );
      continue;
    }
    const storage = createStorageAdapter(mod.id);
    const { registrar, replay } = createDeferredRegistrar();
    const pendingImporters: ImporterPlugin[] = [];
    const pendingNavItems: NavItemDescriptor[] = [];
    const pendingWidgets: WidgetDescriptor[] = [];

    let initOK = false;
    try {
      await mod.init({
        app: registrar,
        storage,
        logger: app.log,
        registerImporter: (plugin) => pendingImporters.push(plugin),
        registerNavItem: (item) => pendingNavItems.push(item),
        registerWidget: (widget) => pendingWidgets.push(widget),
      });
      initOK = true;
    } catch (err) {
      app.log.error({ err, moduleId: mod.id }, "module init failed — module not registered");
    }

    if (!initOK) continue;

    // Commit all buffered registrations now that init succeeded. Routes are
    // mounted via a scoped Fastify plugin so the per-module prefix and any
    // future plugin-level concerns (rate limit, auth) stay contained.
    try {
      for (const plugin of pendingImporters) registerImporter(plugin);
      for (const item of pendingNavItems) registerNavItem(mod.id, item);
      for (const widget of pendingWidgets) registerWidget(mod.id, widget);
      await app.register(
        async (scopedApp) => {
          replay(scopedApp);
        },
        { prefix: `/api/v1/modules/${mod.id}` },
      );
      registerModule(mod);
    } catch (err) {
      app.log.error({ err, moduleId: mod.id }, "module commit failed — module not registered");
    }
  }

  await app.register(moduleRoutes, { prefix: "/api/v1" });

  return app;
}
