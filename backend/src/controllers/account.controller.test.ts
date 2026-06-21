import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import Fastify from "fastify";
import { accountRoutes } from "./account.controller.js";
import { errorHandler } from "../middleware/error-handler.js";

// Controlled session state — mutated per test to simulate auth scenarios.
// The fake session shim below makes request.session.get() return this value,
// which is exactly what requireRole() and the route handler read.
// pwdVersion must match the trailing 10 chars of the mocked password hash
// returned by `prisma.dimUser.findUnique` below — verifySession fails closed
// if the session has no pwdVersion or it doesn't match the stored hash.
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

vi.mock("../services/account.service.js", () => ({
  getAccountsByUser: vi.fn(),
  createAccount: vi.fn(),
  updateAccount: vi.fn(),
  deleteAccount: vi.fn(),
}));

import { ServiceError } from "../errors.js";
import * as accountService from "../services/account.service.js";

const mockGetAccountsByUser = vi.mocked(accountService.getAccountsByUser);
const mockCreateAccount = vi.mocked(accountService.createAccount);
const mockUpdateAccount = vi.mocked(accountService.updateAccount);
const mockDeleteAccount = vi.mocked(accountService.deleteAccount);

const VALID_ID = "11111111-1111-1111-1111-111111111111";

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
    sessionUser = {
      id: "user-1",
      role: "USER",
      email: "test@example.com",
      pwdVersion: "1234567890",
    };
  });

  it("returns 200 with the accounts list", async () => {
    mockGetAccountsByUser.mockResolvedValue([
      { id: "acc-1", name: "Main Account", iban: "CH93 0076 2011 6238 5295 7" },
    ] as never);

    const response = await app.inject({ method: "GET", url: "/api/v1/accounts" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      accounts: [{ id: "acc-1", name: "Main Account", iban: "CH93 0076 2011 6238 5295 7" }],
    });
  });

  it("returns 200 with an empty array when the user has no accounts", async () => {
    mockGetAccountsByUser.mockResolvedValue([]);

    const response = await app.inject({ method: "GET", url: "/api/v1/accounts" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ accounts: [] });
  });

  it("calls findAccountsByUser with the session user id", async () => {
    mockGetAccountsByUser.mockResolvedValue([]);

    await app.inject({ method: "GET", url: "/api/v1/accounts" });

    expect(mockGetAccountsByUser).toHaveBeenCalledExactlyOnceWith("user-1");
  });

  it("returns 401 when there is no session user", async () => {
    sessionUser = undefined;

    const response = await app.inject({ method: "GET", url: "/api/v1/accounts" });

    expect(response.statusCode).toBe(401);
    expect(mockGetAccountsByUser).not.toHaveBeenCalled();
  });

  it("returns multiple accounts in the response", async () => {
    mockGetAccountsByUser.mockResolvedValue([
      { id: "acc-1", name: "Checking", iban: "CH93 0076 2011 6238 5295 7" },
      { id: "acc-2", name: "Savings", iban: "CH56 0483 5012 3456 7800 9" },
    ] as never);

    const response = await app.inject({ method: "GET", url: "/api/v1/accounts" });

    expect(response.statusCode).toBe(200);
    expect(response.json().accounts).toHaveLength(2);
  });
});

describe("Account write endpoints", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    // Register the real error handler so thrown ServiceErrors map to their
    // status codes (404/409) rather than the Fastify default 500.
    app.setErrorHandler(errorHandler);
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
    sessionUser = {
      id: "user-1",
      role: "USER",
      email: "test@example.com",
      pwdVersion: "1234567890",
    };
  });

  describe("POST /api/v1/accounts", () => {
    it("creates an account and returns 201", async () => {
      mockCreateAccount.mockResolvedValue({ id: "acc-1", name: "Main", iban: "CH93 0001" });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/accounts",
        payload: { name: "Main", iban: "CH93 0001" },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual({
        account: { id: "acc-1", name: "Main", iban: "CH93 0001" },
      });
      expect(mockCreateAccount).toHaveBeenCalledWith("user-1", { name: "Main", iban: "CH93 0001" });
    });

    it("rejects a missing name with 400 without calling the service", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/accounts",
        payload: { iban: "CH93 0001" },
      });

      expect(response.statusCode).toBe(400);
      expect(mockCreateAccount).not.toHaveBeenCalled();
    });

    it("propagates a duplicate-IBAN 409 from the service", async () => {
      mockCreateAccount.mockRejectedValue(
        new ServiceError(409, "An account with this IBAN already exists"),
      );

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/accounts",
        payload: { name: "Main", iban: "CH93 0001" },
      });

      expect(response.statusCode).toBe(409);
    });

    it("returns 401 when unauthenticated", async () => {
      sessionUser = undefined;
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/accounts",
        payload: { name: "Main", iban: "CH93 0001" },
      });
      expect(response.statusCode).toBe(401);
      expect(mockCreateAccount).not.toHaveBeenCalled();
    });
  });

  describe("PATCH /api/v1/accounts/:id", () => {
    it("updates an account and returns 200", async () => {
      mockUpdateAccount.mockResolvedValue({ id: VALID_ID, name: "Renamed", iban: "CH93 0001" });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/accounts/${VALID_ID}`,
        payload: { name: "Renamed" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().account.name).toBe("Renamed");
      expect(mockUpdateAccount).toHaveBeenCalledWith(VALID_ID, "user-1", { name: "Renamed" });
    });

    it("rejects an empty body with 400", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/accounts/${VALID_ID}`,
        payload: {},
      });
      expect(response.statusCode).toBe(400);
      expect(mockUpdateAccount).not.toHaveBeenCalled();
    });

    it("returns 404 when the service reports a missing account", async () => {
      mockUpdateAccount.mockRejectedValue(new ServiceError(404, "Account not found"));

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/accounts/${VALID_ID}`,
        payload: { name: "Renamed" },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("DELETE /api/v1/accounts/:id", () => {
    it("deletes an account and returns 204", async () => {
      mockDeleteAccount.mockResolvedValue(undefined);

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/accounts/${VALID_ID}`,
      });

      expect(response.statusCode).toBe(204);
      expect(mockDeleteAccount).toHaveBeenCalledWith(VALID_ID, "user-1");
    });

    it("returns 409 when the account still has transactions", async () => {
      mockDeleteAccount.mockRejectedValue(
        new ServiceError(409, "Cannot delete an account that still has transactions.", {
          code: "ACCOUNT_HAS_TRANSACTIONS",
          transactionCount: 3,
        }),
      );

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/accounts/${VALID_ID}`,
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe("ACCOUNT_HAS_TRANSACTIONS");
    });
  });
});
