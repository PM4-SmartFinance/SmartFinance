import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import Fastify from "fastify";
import { transactionRoutes } from "./transaction.controller.js";

// Controlled session state — mutated per test to simulate auth scenarios.
// The fake session shim below makes request.session.get() return this value,
// which is exactly what requireRole() and the route handler read.
let sessionUser: { id: string; role: string; email: string } | undefined = {
  id: "user-1",
  role: "USER",
  email: "test@example.com",
};

vi.mock("../services/transaction.service.js", () => ({
  listTransactions: vi.fn(),
  autoCategorizeTransactions: vi.fn(),
}));

vi.mock("../services/import.service.js", async () => {
  const actual = await vi.importActual<typeof import("../services/import.service.js")>(
    "../services/import.service.js",
  );
  return {
    ...actual,
    importTransactions: vi.fn(),
  };
});

import * as transactionService from "../services/transaction.service.js";

const mockAutoCategorize = vi.mocked(transactionService.autoCategorizeTransactions);

describe("POST /api/v1/transactions/auto-categorize", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    // Minimal session shim — same pattern as account.controller.test.ts.
    app.decorateRequest("session", null);
    app.addHook("onRequest", async (request) => {
      Object.defineProperty(request, "session", {
        configurable: true,
        value: { get: () => sessionUser, set: vi.fn() },
      });
    });

    await app.register(transactionRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser = { id: "user-1", role: "USER", email: "test@example.com" };
  });

  it("returns 200 with the categorized count from the service", async () => {
    mockAutoCategorize.mockResolvedValue({ categorized: 7 });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/transactions/auto-categorize",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ categorized: 7 });
  });

  it("forwards the session user id (not a request param) to the service", async () => {
    // Critical IDOR guard: the user id passed to the categorization engine
    // must come from the authenticated session, never from any client input.
    mockAutoCategorize.mockResolvedValue({ categorized: 0 });
    sessionUser = { id: "user-42", role: "USER", email: "x@example.com" };

    await app.inject({ method: "POST", url: "/api/v1/transactions/auto-categorize" });

    expect(mockAutoCategorize).toHaveBeenCalledExactlyOnceWith("user-42");
  });

  it("returns 401 when there is no authenticated session", async () => {
    sessionUser = undefined;

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/transactions/auto-categorize",
    });

    expect(response.statusCode).toBe(401);
    expect(mockAutoCategorize).not.toHaveBeenCalled();
  });

  it("returns 403 when the session user has an unrecognized role", async () => {
    sessionUser = { id: "user-1", role: "GUEST", email: "g@example.com" };

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/transactions/auto-categorize",
    });

    expect(response.statusCode).toBe(403);
    expect(mockAutoCategorize).not.toHaveBeenCalled();
  });

  it("allows ADMIN to call the endpoint (role hierarchy)", async () => {
    sessionUser = { id: "admin-1", role: "ADMIN", email: "a@example.com" };
    mockAutoCategorize.mockResolvedValue({ categorized: 3 });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/transactions/auto-categorize",
    });

    expect(response.statusCode).toBe(200);
    expect(mockAutoCategorize).toHaveBeenCalledExactlyOnceWith("admin-1");
  });

  it("returns a response that conforms to the declared schema (categorized: integer)", async () => {
    mockAutoCategorize.mockResolvedValue({ categorized: 0 });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/transactions/auto-categorize",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(Object.keys(body)).toEqual(["categorized"]);
    expect(Number.isInteger(body.categorized)).toBe(true);
  });
});
