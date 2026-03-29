import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import Fastify from "fastify";
import { accountRoutes } from "./account.controller.js";

// Controlled session state — mutated per test to simulate auth scenarios.
// The fake session shim below makes request.session.get() return this value,
// which is exactly what requireRole() and the route handler read.
let sessionUser: { id: string; role: string; email: string } | undefined = {
  id: "user-1",
  role: "USER",
  email: "test@example.com",
};

vi.mock("../repositories/account.repository.js", () => ({
  findAccountsByUser: vi.fn(),
}));

import * as accountRepo from "../repositories/account.repository.js";

const mockFindAccountsByUser = vi.mocked(accountRepo.findAccountsByUser);

describe("GET /api/v1/accounts", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    // Minimal session shim: decorates each request with a session object whose
    // get() returns the shared sessionUser variable. This lets the real
    // requireRole middleware and the route handler both read the same value,
    // without needing a real @fastify/secure-session plugin or a cookie.
    app.decorateRequest("session", null);
    app.addHook("onRequest", async (request) => {
      Object.defineProperty(request, "session", {
        configurable: true,
        value: { get: () => sessionUser, set: vi.fn() },
      });
    });

    await app.register(accountRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser = { id: "user-1", role: "USER", email: "test@example.com" };
  });

  it("returns 200 with the accounts list", async () => {
    mockFindAccountsByUser.mockResolvedValue([
      { id: "acc-1", name: "Main Account", iban: "CH93 0076 2011 6238 5295 7" },
    ] as never);

    const response = await app.inject({ method: "GET", url: "/api/v1/accounts" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      accounts: [{ id: "acc-1", name: "Main Account", iban: "CH93 0076 2011 6238 5295 7" }],
    });
  });

  it("returns 200 with an empty array when the user has no accounts", async () => {
    mockFindAccountsByUser.mockResolvedValue([]);

    const response = await app.inject({ method: "GET", url: "/api/v1/accounts" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ accounts: [] });
  });

  it("calls findAccountsByUser with the session user id", async () => {
    mockFindAccountsByUser.mockResolvedValue([]);

    await app.inject({ method: "GET", url: "/api/v1/accounts" });

    expect(mockFindAccountsByUser).toHaveBeenCalledExactlyOnceWith("user-1");
  });

  it("returns 401 when there is no session user", async () => {
    sessionUser = undefined;

    const response = await app.inject({ method: "GET", url: "/api/v1/accounts" });

    expect(response.statusCode).toBe(401);
    expect(mockFindAccountsByUser).not.toHaveBeenCalled();
  });

  it("returns multiple accounts in the response", async () => {
    mockFindAccountsByUser.mockResolvedValue([
      { id: "acc-1", name: "Checking", iban: "CH93 0076 2011 6238 5295 7" },
      { id: "acc-2", name: "Savings", iban: "CH56 0483 5012 3456 7800 9" },
    ] as never);

    const response = await app.inject({ method: "GET", url: "/api/v1/accounts" });

    expect(response.statusCode).toBe(200);
    expect(response.json().accounts).toHaveLength(2);
  });
});
