import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import Fastify from "fastify";
import { transactionRoutes } from "./transaction.controller.js";
import { errorHandler } from "../middleware/error-handler.js";
import { ServiceError } from "../errors.js";

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

const mockListTransactions = vi.mocked(transactionService.listTransactions);
const mockAutoCategorize = vi.mocked(transactionService.autoCategorizeTransactions);
const mockGetTransaction = vi.mocked(transactionService.getTransaction);
const mockUpdateTransaction = vi.mocked(transactionService.updateTransaction);
const mockDeleteTransaction = vi.mocked(transactionService.deleteTransaction);

// Valid UUID used across all single-resource route tests.
const VALID_TX_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

function buildTestApp() {
  const testApp = Fastify({ logger: false });
  testApp.setErrorHandler(errorHandler);
  testApp.decorateRequest("session", null);
  testApp.addHook("onRequest", async (request) => {
    Object.defineProperty(request, "session", {
      configurable: true,
      value: { get: () => sessionUser, set: vi.fn() },
    });
  });
  return testApp;
}

describe("POST /api/v1/transactions/auto-categorize", () => {
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

  it("returns 400 when body contains unexpected properties", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/transactions/auto-categorize",
      payload: { foo: "bar" },
    });

    expect(response.statusCode).toBe(400);
    expect(mockAutoCategorize).not.toHaveBeenCalled();
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

  it("returns 404 when service throws ServiceError 404", async () => {
    mockGetTransaction.mockRejectedValue(new ServiceError(404, "Transaction not found"));
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/transactions/${VALID_TX_ID}`,
    });
    expect(response.statusCode).toBe(404);
  });

  it("returns 400 when :id is not a valid UUID", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/transactions/not-a-uuid",
    });
    expect(response.statusCode).toBe(400);
    expect(mockGetTransaction).not.toHaveBeenCalled();
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

  it("allows ADMIN to update transactions (role hierarchy)", async () => {
    sessionUser = { id: "admin-1", role: "ADMIN", email: "a@example.com" };
    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/transactions/${VALID_TX_ID}`,
      payload: { notes: "admin edit" },
    });
    expect(response.statusCode).toBe(200);
    expect(mockUpdateTransaction).toHaveBeenCalledExactlyOnceWith(VALID_TX_ID, "admin-1", {
      notes: "admin edit",
    });
  });

  it("returns 404 when service throws ServiceError 404", async () => {
    mockUpdateTransaction.mockRejectedValue(new ServiceError(404, "Transaction not found"));
    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/transactions/${VALID_TX_ID}`,
      payload: { notes: "test" },
    });
    expect(response.statusCode).toBe(404);
  });

  it("returns 400 when :id is not a valid UUID", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/transactions/not-a-uuid",
      payload: { notes: "test" },
    });
    expect(response.statusCode).toBe(400);
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

  it("returns 404 when service throws ServiceError 404", async () => {
    mockDeleteTransaction.mockRejectedValue(new ServiceError(404, "Transaction not found"));
    const response = await app.inject({
      method: "DELETE",
      url: `/api/v1/transactions/${VALID_TX_ID}`,
    });
    expect(response.statusCode).toBe(404);
  });

  it("returns 400 when :id is not a valid UUID", async () => {
    const response = await app.inject({
      method: "DELETE",
      url: "/api/v1/transactions/not-a-uuid",
    });
    expect(response.statusCode).toBe(400);
    expect(mockDeleteTransaction).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/transactions", () => {
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
    mockListTransactions.mockResolvedValue({
      data: [],
      meta: { totalCount: 0, totalPages: 0, page: 1, limit: 20 },
    } as never);
  });

  it("returns 200 with the list result from the service", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/transactions",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: [],
      meta: { totalCount: 0, totalPages: 0, page: 1, limit: 20 },
    });
  });

  it("forwards the session user id (not a request param) to the service", async () => {
    sessionUser = { id: "user-42", role: "USER", email: "x@example.com" };

    await app.inject({ method: "GET", url: "/api/v1/transactions" });

    expect(mockListTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-42" }),
    );
  });

  it("returns 401 when there is no authenticated session", async () => {
    sessionUser = undefined;

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/transactions",
    });

    expect(response.statusCode).toBe(401);
    expect(mockListTransactions).not.toHaveBeenCalled();
  });

  it("returns 403 when the session user has an insufficient role", async () => {
    sessionUser = { id: "user-1", role: "GUEST", email: "g@example.com" };

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/transactions",
    });

    expect(response.statusCode).toBe(403);
    expect(mockListTransactions).not.toHaveBeenCalled();
  });

  it("allows ADMIN to call the endpoint (role hierarchy)", async () => {
    sessionUser = { id: "admin-1", role: "ADMIN", email: "a@example.com" };

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/transactions",
    });

    expect(response.statusCode).toBe(200);
    expect(mockListTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin-1" }),
    );
  });

  it("passes query parameters to the service", async () => {
    await app.inject({
      method: "GET",
      url: "/api/v1/transactions?page=2&limit=10&sortBy=amount&sortOrder=asc",
    });

    expect(mockListTransactions).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        page: 2,
        limit: 10,
        sortBy: "amount",
        sortOrder: "asc",
      }),
    );
  });

  it("returns 400 for invalid sortBy value", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/transactions?sortBy=invalid",
    });

    expect(response.statusCode).toBe(400);
    expect(mockListTransactions).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/transactions/import", () => {
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
  });

  it("returns 401 when there is no authenticated session", async () => {
    sessionUser = undefined;

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/transactions/import?accountId=acc-1&format=neon",
      headers: { "content-type": "multipart/form-data; boundary=---test" },
      payload: "-----test--",
    });

    expect(response.statusCode).toBe(401);
  });

  it("returns 403 when the session user has an insufficient role", async () => {
    sessionUser = { id: "user-1", role: "GUEST", email: "g@example.com" };

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/transactions/import?accountId=acc-1&format=neon",
      headers: { "content-type": "multipart/form-data; boundary=---test" },
      payload: "-----test--",
    });

    expect(response.statusCode).toBe(403);
  });

  it("returns 400 when format is not a supported value", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/transactions/import?accountId=acc-1&format=unknownbank",
      headers: { "content-type": "multipart/form-data; boundary=---test" },
      payload: "-----test--",
    });

    expect(response.statusCode).toBe(400);
  });

  it("returns 400 when accountId is missing", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/transactions/import?format=neon",
      headers: { "content-type": "multipart/form-data; boundary=---test" },
      payload: "-----test--",
    });

    expect(response.statusCode).toBe(400);
  });
});
