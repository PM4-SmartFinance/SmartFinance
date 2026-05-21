import { describe, it, expect, afterEach, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { register as promRegister } from "prom-client";
import { buildApp } from "../src/app.js";
import { getAllNavItems } from "../src/services/nav-item-registry.service.js";
import { getAllWidgets } from "../src/services/widget-registry.service.js";
import { getAllPluginFormats } from "../src/services/importer-registry.service.js";
import { getModule } from "../src/services/module-registry.service.js";
import type { SmartFinanceModule } from "../src/types/module.js";

let lastApp: FastifyInstance | undefined;

beforeEach(() => {
  // fastify-metrics registers default + custom Prom metrics on the global
  // prom-client registry on every buildApp() call. Repeated calls in tests
  // collide; clear the registry to keep buildApp idempotent.
  promRegister.clear();
});

afterEach(async () => {
  if (lastApp) {
    await lastApp.close();
    lastApp = undefined;
  }
});

function noopGetStatus(state: { initialized: boolean; error?: string }) {
  return () => ({ ...state });
}

describe("buildApp module bootstrap", () => {
  it("skips a module whose id fails MODULE_ID_RE and continues to start", async () => {
    const goodModule: SmartFinanceModule = {
      id: "good-mod",
      name: "Good",
      requiredRole: "USER",
      async init(ctx) {
        ctx.registerNavItem({ label: "Good", path: "/modules/good-mod" });
      },
      getStatus: noopGetStatus({ initialized: true }),
    };
    const badIdModule: SmartFinanceModule = {
      id: "INVALID id with spaces",
      name: "Bad",
      requiredRole: "USER",
      async init(ctx) {
        ctx.registerNavItem({ label: "Bad", path: "/should-not-exist" });
      },
      getStatus: noopGetStatus({ initialized: true }),
    };

    lastApp = await buildApp({ modules: [() => goodModule, () => badIdModule] });

    expect(getModule("good-mod")).toBeDefined();
    expect(getModule("INVALID id with spaces")).toBeUndefined();
    const navLabels = getAllNavItems().map((n) => n.label);
    expect(navLabels).toContain("Good");
    expect(navLabels).not.toContain("Bad");
  });

  it("isolates a module whose init() throws: other modules still register", async () => {
    const goodModule: SmartFinanceModule = {
      id: "good-mod",
      name: "Good",
      requiredRole: "USER",
      async init(ctx) {
        ctx.registerNavItem({ label: "Good", path: "/modules/good-mod" });
        ctx.registerWidget({
          widgetId: "good-w",
          title: "Good Widget",
          dataEndpoint: "/modules/good-mod/data",
        });
      },
      getStatus: noopGetStatus({ initialized: true }),
    };
    const failingModule: SmartFinanceModule = {
      id: "bad-mod",
      name: "Bad",
      requiredRole: "USER",
      async init(ctx) {
        // First register something, then throw — verifies that the partial
        // registration is rolled back (M-2 two-phase init).
        ctx.registerNavItem({ label: "Bad", path: "/modules/bad-mod" });
        throw new Error("boom");
      },
      getStatus: noopGetStatus({ initialized: false, error: "boom" }),
    };

    lastApp = await buildApp({ modules: [() => goodModule, () => failingModule] });

    expect(getModule("good-mod")).toBeDefined();
    expect(getModule("bad-mod")).toBeUndefined();
    const navLabels = getAllNavItems().map((n) => n.label);
    expect(navLabels).toContain("Good");
    expect(navLabels).not.toContain("Bad");
    const widgetIds = getAllWidgets().map((w) => w.widgetId);
    expect(widgetIds).toContain("good-w");
  });

  it("a failed module does not leave routes mounted on Fastify", async () => {
    const failingModule: SmartFinanceModule = {
      id: "bad-mod",
      name: "Bad",
      requiredRole: "USER",
      async init(ctx) {
        ctx.app.get("/ghost-route", async (_req, reply) => reply.send({ shouldNot: "exist" }));
        throw new Error("boom");
      },
      getStatus: noopGetStatus({ initialized: false, error: "boom" }),
    };

    lastApp = await buildApp({ modules: [() => failingModule] });

    const res = await lastApp.inject({
      method: "GET",
      url: "/api/v1/modules/bad-mod/ghost-route",
    });
    expect(res.statusCode).toBe(404);
  });

  it("core /api/v1/health stays reachable when a module init fails", async () => {
    const failingModule: SmartFinanceModule = {
      id: "fail-mod",
      name: "Fail",
      requiredRole: "USER",
      async init() {
        throw new Error("init exploded");
      },
      getStatus: noopGetStatus({ initialized: false, error: "init exploded" }),
    };

    lastApp = await buildApp({ modules: [() => failingModule] });

    const res = await lastApp.inject({ method: "GET", url: "/api/v1/health" });
    expect(res.statusCode).toBe(200);
  });

  it("buffers importer registration: a failed module does not register its importer", async () => {
    const failingModule: SmartFinanceModule = {
      id: "imp-mod",
      name: "Imp",
      requiredRole: "USER",
      async init(ctx) {
        ctx.registerImporter({
          format: "imp-mod-format",
          label: "Imp Mod",
          parse: () => [],
        });
        throw new Error("oops");
      },
      getStatus: noopGetStatus({ initialized: false, error: "oops" }),
    };

    lastApp = await buildApp({ modules: [() => failingModule] });

    const formats = getAllPluginFormats().map((f) => f.format);
    expect(formats).not.toContain("imp-mod-format");
  });

  it("factory pattern: each buildApp() call produces a fresh module instance", async () => {
    const factoryState = { calls: 0 };
    const factory = (): SmartFinanceModule => {
      factoryState.calls += 1;
      const id = factoryState.calls;
      return {
        id: "freshness-mod",
        name: `Freshness #${id}`,
        requiredRole: "USER",
        async init() {
          /* no-op */
        },
        getStatus: noopGetStatus({ initialized: true }),
      };
    };

    lastApp = await buildApp({ modules: [factory] });
    const first = getModule("freshness-mod");
    expect(first?.name).toBe("Freshness #1");
    await lastApp.close();
    promRegister.clear();

    lastApp = await buildApp({ modules: [factory] });
    const second = getModule("freshness-mod");
    expect(second?.name).toBe("Freshness #2");
    expect(second).not.toBe(first);
  });
});
