import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { authRoutes } from "./auth.controller.js";

let sessionUser: { id: string; role: string; email: string; pwdVersion?: string } | undefined = {
  id: "user-1",
  role: "USER",
  email: "test@example.com",
  pwdVersion: "1234567890",
};

vi.mock("../middleware/rbac.js", () => ({
  verifySession: vi.fn(async () => {
    if (!sessionUser) throw new Error("Unauthorized");
    return sessionUser;
  }),
}));

vi.mock("../services/user.service.js", () => ({
  getProfile: vi.fn(),
}));

import * as userService from "../services/user.service.js";

const mockGetProfile = vi.mocked(userService.getProfile);

function buildTestApp() {
  const app = Fastify({ logger: false });
  app.decorateRequest("session", null);
  app.addHook("onRequest", async (request) => {
    Object.defineProperty(request, "session", {
      configurable: true,
      value: {
        get: () => sessionUser,
        set: vi.fn(),
        delete: vi.fn(),
      },
    });
  });
  return app;
}

describe("GET /api/v1/auth/me", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.register(authRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser = {
      id: "user-1",
      role: "USER",
      email: "test@example.com",
      pwdVersion: "1234567890",
    };
  });

  it("returns the current profile including the configured display name", async () => {
    mockGetProfile.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
      role: "USER",
      active: true,
      createdAt: new Date("2025-01-01"),
    });

    const response = await app.inject({ method: "GET", url: "/api/v1/auth/me" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      user: {
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
      },
    });
    expect(mockGetProfile).toHaveBeenCalledWith("user-1");
  });
});
