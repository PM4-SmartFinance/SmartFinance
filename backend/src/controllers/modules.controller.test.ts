import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import Fastify from "fastify";
import { moduleRoutes } from "./modules.controller.js";

let sessionUser: { id: string; role: string; email: string; pwdVersion?: string } | undefined = {
  id: "user-1",
  role: "USER",
  email: "test@example.com",
  pwdVersion: "1234567890",
};

vi.mock("../prisma.js", () => ({
  prisma: {
    dimUser: {
      findUnique: vi.fn().mockResolvedValue({
        active: true,
        password: "mocked-hash-1234567890",
        role: "USER",
      }),
    },
  },
}));

vi.mock("../services/module-registry.service.js", () => ({
  getAllModules: vi.fn(),
  getModule: vi.fn(),
}));

vi.mock("../services/nav-item-registry.service.js", () => ({
  getAllNavItems: vi.fn(),
}));

vi.mock("../services/widget-registry.service.js", () => ({
  getAllWidgets: vi.fn(),
}));

import * as moduleRegistry from "../services/module-registry.service.js";
import * as navItemRegistry from "../services/nav-item-registry.service.js";
import * as widgetRegistry from "../services/widget-registry.service.js";

const mockGetAllModules = vi.mocked(moduleRegistry.getAllModules);
const mockGetModule = vi.mocked(moduleRegistry.getModule);
const mockGetAllNavItems = vi.mocked(navItemRegistry.getAllNavItems);
const mockGetAllWidgets = vi.mocked(widgetRegistry.getAllWidgets);

describe("module routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    app.decorateRequest("session", null);
    app.addHook("onRequest", async (request) => {
      Object.defineProperty(request, "session", {
        configurable: true,
        value: { get: () => sessionUser, set: vi.fn() },
      });
    });
    await app.register(moduleRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser = {
      id: "user-1",
      role: "USER",
      email: "test@example.com",
      pwdVersion: "1234567890",
    };
  });

  describe("GET /api/v1/modules", () => {
    it("returns 200 with all registered modules", async () => {
      mockGetAllModules.mockReturnValue([
        {
          id: "hello-world",
          name: "Hello World",
          requiredRole: "USER",
          status: { initialized: true },
        },
      ]);
      const response = await app.inject({ method: "GET", url: "/api/v1/modules" });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        modules: [
          {
            id: "hello-world",
            name: "Hello World",
            requiredRole: "USER",
            status: { initialized: true },
          },
        ],
      });
    });

    it("returns 200 with empty array when no modules are registered", async () => {
      mockGetAllModules.mockReturnValue([]);
      const response = await app.inject({ method: "GET", url: "/api/v1/modules" });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ modules: [] });
    });

    it("strips the error field from module status in the list response", async () => {
      mockGetAllModules.mockReturnValue([
        {
          id: "broken",
          name: "Broken Module",
          requiredRole: "USER",
          status: { initialized: false, error: "init failed: secret/path/info" },
        },
      ]);
      const response = await app.inject({ method: "GET", url: "/api/v1/modules" });
      expect(response.statusCode).toBe(200);
      expect(response.json().modules[0].status).toEqual({ initialized: false });
    });

    it("returns 401 when there is no session", async () => {
      sessionUser = undefined;
      const response = await app.inject({ method: "GET", url: "/api/v1/modules" });
      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/modules/:moduleId/status", () => {
    it("returns 200 with module status when admin requests it", async () => {
      sessionUser = {
        id: "user-1",
        role: "ADMIN",
        email: "admin@example.com",
        pwdVersion: "1234567890",
      };
      mockGetModule.mockReturnValue({
        id: "hello-world",
        name: "Hello World",
        requiredRole: "USER",
        init: vi.fn(),
        getStatus: vi.fn().mockReturnValue({ initialized: true }),
      } as never);

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/modules/hello-world/status",
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        id: "hello-world",
        name: "Hello World",
        status: { initialized: true },
      });
    });

    it("returns 403 when a non-admin user requests module status", async () => {
      mockGetModule.mockReturnValue(undefined);
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/modules/hello-world/status",
      });
      expect(response.statusCode).toBe(403);
    });

    it("returns 404 when the module does not exist", async () => {
      sessionUser = {
        id: "user-1",
        role: "ADMIN",
        email: "admin@example.com",
        pwdVersion: "1234567890",
      };
      mockGetModule.mockReturnValue(undefined);
      const response = await app.inject({ method: "GET", url: "/api/v1/modules/unknown/status" });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ message: "Module not found" });
    });

    it("returns 401 when there is no session", async () => {
      sessionUser = undefined;
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/modules/hello-world/status",
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/modules/nav-items", () => {
    it("returns 200 with all registered nav items", async () => {
      mockGetAllNavItems.mockReturnValue([
        { moduleId: "savings-goals", label: "Savings Goals", path: "/modules/savings-goals" },
      ]);
      const response = await app.inject({ method: "GET", url: "/api/v1/modules/nav-items" });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        navItems: [
          { moduleId: "savings-goals", label: "Savings Goals", path: "/modules/savings-goals" },
        ],
      });
    });

    it("returns 200 with empty array when no nav items are registered", async () => {
      mockGetAllNavItems.mockReturnValue([]);
      const response = await app.inject({ method: "GET", url: "/api/v1/modules/nav-items" });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ navItems: [] });
    });

    it("returns 401 when there is no session", async () => {
      sessionUser = undefined;
      const response = await app.inject({ method: "GET", url: "/api/v1/modules/nav-items" });
      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/modules/widgets", () => {
    it("returns 200 with all registered widgets", async () => {
      mockGetAllWidgets.mockReturnValue([
        {
          moduleId: "savings-goals",
          widgetId: "savings-goals-summary",
          title: "Savings Goals",
          dataEndpoint: "/modules/savings-goals/goals/widget",
        },
      ]);
      const response = await app.inject({ method: "GET", url: "/api/v1/modules/widgets" });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        widgets: [
          {
            moduleId: "savings-goals",
            widgetId: "savings-goals-summary",
            title: "Savings Goals",
            dataEndpoint: "/modules/savings-goals/goals/widget",
          },
        ],
      });
    });

    it("returns 200 with empty array when no widgets are registered", async () => {
      mockGetAllWidgets.mockReturnValue([]);
      const response = await app.inject({ method: "GET", url: "/api/v1/modules/widgets" });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ widgets: [] });
    });

    it("returns 401 when there is no session", async () => {
      sessionUser = undefined;
      const response = await app.inject({ method: "GET", url: "/api/v1/modules/widgets" });
      expect(response.statusCode).toBe(401);
    });
  });
});
