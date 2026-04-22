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
  getTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
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
const mockGetTransaction = vi.mocked(transactionService.getTransaction);
const mockUpdateTransaction = vi.mocked(transactionService.updateTransaction);
const mockDeleteTransaction = vi.mocked(transactionService.deleteTransaction);

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

// Valid UUID used across all single-resource route tests.
const VALID_TX_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

function buildTestApp() {
  const testApp = Fastify({ logger: false });
  testApp.decorateRequest("session", null);
  testApp.addHook("onRequest", async (request) => {
    Object.defineProperty(request, "session", {
      configurable: true,
      value: { get: () => sessionUser, set: vi.fn() },
    });
  });
  return testApp;
}

describe("GET /api/v1/transactions/:id", () => {
  let app: FastifyInstance;
  const mockTx = { id: VALID_TX_ID, amount: "42.00", notes: null };

  beforeAll(async () => {
    app = buildTestApp();
    await app.register(transactionRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser = { id: "user-1", role: "USER", email: "test@example.com" };
    mockGetTransaction.mockResolvedValue(mockTx as never);
  });

  it("returns 200 with the transaction wrapped in a transaction key", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/transactions/${VALID_TX_ID}`,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ transaction: mockTx });
  });

  it("passes the route :id param and the session user id to the service", async () => {
    sessionUser = { id: "user-42", role: "USER", email: "x@example.com" };
    await app.inject({ method: "GET", url: `/api/v1/transactions/${VALID_TX_ID}` });
    expect(mockGetTransaction).toHaveBeenCalledExactlyOnceWith(VALID_TX_ID, "user-42");
  });

  it("returns 401 when there is no authenticated session", async () => {
    sessionUser = undefined;
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/transactions/${VALID_TX_ID}`,
    });
    expect(response.statusCode).toBe(401);
    expect(mockGetTransaction).not.toHaveBeenCalled();
  });

  it("returns 403 when the session user has an insufficient role", async () => {
    sessionUser = { id: "user-1", role: "GUEST", email: "g@example.com" };
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/transactions/${VALID_TX_ID}`,
    });
    expect(response.statusCode).toBe(403);
    expect(mockGetTransaction).not.toHaveBeenCalled();
  });

  it("allows ADMIN to call the endpoint (role hierarchy)", async () => {
    sessionUser = { id: "admin-1", role: "ADMIN", email: "a@example.com" };
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/transactions/${VALID_TX_ID}`,
    });
    expect(response.statusCode).toBe(200);
    expect(mockGetTransaction).toHaveBeenCalledExactlyOnceWith(VALID_TX_ID, "admin-1");
  });
});

describe("PATCH /api/v1/transactions/:id", () => {
  let app: FastifyInstance;
  const mockTx = { id: VALID_TX_ID, notes: "updated", manualOverride: false };

  beforeAll(async () => {
    app = buildTestApp();
    await app.register(transactionRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser = { id: "user-1", role: "USER", email: "test@example.com" };
    mockUpdateTransaction.mockResolvedValue(mockTx as never);
  });

  it("returns 200 with the updated transaction wrapped in a transaction key", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/transactions/${VALID_TX_ID}`,
      payload: { notes: "updated" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ transaction: mockTx });
  });

  it("passes the route :id, session user id, and request body to the service", async () => {
    sessionUser = { id: "user-42", role: "USER", email: "x@example.com" };
    await app.inject({
      method: "PATCH",
      url: `/api/v1/transactions/${VALID_TX_ID}`,
      payload: { notes: "hello" },
    });
    expect(mockUpdateTransaction).toHaveBeenCalledExactlyOnceWith(VALID_TX_ID, "user-42", {
      notes: "hello",
    });
  });

  it("returns 400 when body has no recognized fields (minProperties: 1 violation)", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/transactions/${VALID_TX_ID}`,
      payload: {},
    });
    expect(response.statusCode).toBe(400);
    expect(mockUpdateTransaction).not.toHaveBeenCalled();
  });

  it("returns 401 when there is no authenticated session", async () => {
    sessionUser = undefined;
    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/transactions/${VALID_TX_ID}`,
      payload: { notes: "test" },
    });
    expect(response.statusCode).toBe(401);
    expect(mockUpdateTransaction).not.toHaveBeenCalled();
  });

  it("returns 403 when the session user has an insufficient role", async () => {
    sessionUser = { id: "user-1", role: "GUEST", email: "g@example.com" };
    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/transactions/${VALID_TX_ID}`,
      payload: { notes: "test" },
    });
    expect(response.statusCode).toBe(403);
    expect(mockUpdateTransaction).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/v1/transactions/:id", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.register(transactionRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser = { id: "user-1", role: "USER", email: "test@example.com" };
    mockDeleteTransaction.mockResolvedValue(undefined);
  });

  it("returns 204 on successful deletion", async () => {
    const response = await app.inject({
      method: "DELETE",
      url: `/api/v1/transactions/${VALID_TX_ID}`,
    });
    expect(response.statusCode).toBe(204);
  });

  it("passes the route :id and session user id to the service", async () => {
    sessionUser = { id: "user-42", role: "USER", email: "x@example.com" };
    await app.inject({ method: "DELETE", url: `/api/v1/transactions/${VALID_TX_ID}` });
    expect(mockDeleteTransaction).toHaveBeenCalledExactlyOnceWith(VALID_TX_ID, "user-42");
  });

  it("returns 401 when there is no authenticated session", async () => {
    sessionUser = undefined;
    const response = await app.inject({
      method: "DELETE",
      url: `/api/v1/transactions/${VALID_TX_ID}`,
    });
    expect(response.statusCode).toBe(401);
    expect(mockDeleteTransaction).not.toHaveBeenCalled();
  });

  it("returns 403 when the session user has an insufficient role", async () => {
    sessionUser = { id: "user-1", role: "GUEST", email: "g@example.com" };
    const response = await app.inject({
      method: "DELETE",
      url: `/api/v1/transactions/${VALID_TX_ID}`,
    });
    expect(response.statusCode).toBe(403);
    expect(mockDeleteTransaction).not.toHaveBeenCalled();
  });

  it("allows ADMIN to delete transactions (role hierarchy)", async () => {
    sessionUser = { id: "admin-1", role: "ADMIN", email: "a@example.com" };
    const response = await app.inject({
      method: "DELETE",
      url: `/api/v1/transactions/${VALID_TX_ID}`,
    });
    expect(response.statusCode).toBe(204);
    expect(mockDeleteTransaction).toHaveBeenCalledExactlyOnceWith(VALID_TX_ID, "admin-1");
  });
});
