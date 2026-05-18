import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import Fastify from "fastify";
import { transactionRoutes } from "./transaction.controller.js";
import { errorHandler } from "../middleware/error-handler.js";
import { ServiceError } from "../errors.js";

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
import * as importService from "../services/import.service.js";

const mockListTransactions = vi.mocked(transactionService.listTransactions);
const mockAutoCategorize = vi.mocked(transactionService.autoCategorizeTransactions);
const mockGetTransaction = vi.mocked(transactionService.getTransaction);
const mockUpdateTransaction = vi.mocked(transactionService.updateTransaction);
const mockDeleteTransaction = vi.mocked(transactionService.deleteTransaction);
const mockImportTransactions = vi.mocked(importService.importTransactions);

/**
 * Build a minimal multipart/form-data body that @fastify/multipart can parse.
 * Returns `{ payload, headers }` ready to feed to `app.inject()`.
 */
function buildMultipart(fileFieldName: string, filename: string, content: string) {
  const boundary = "----testBoundary12345";
  const body =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="${fileFieldName}"; filename="${filename}"\r\n` +
    `Content-Type: text/csv\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--\r\n`;
  return {
    payload: body,
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}

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
    sessionUser = {
      id: "user-1",
      role: "USER",
      email: "test@example.com",
      pwdVersion: "1234567890",
    };
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
    sessionUser = {
      id: "user-42",
      role: "USER",
      email: "x@example.com",
      pwdVersion: "1234567890",
    };

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
    sessionUser = {
      id: "user-1",
      role: "GUEST",
      email: "g@example.com",
      pwdVersion: "1234567890",
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/transactions/auto-categorize",
    });

    expect(response.statusCode).toBe(403);
    expect(mockAutoCategorize).not.toHaveBeenCalled();
  });

  it("allows ADMIN to call the endpoint (role hierarchy)", async () => {
    sessionUser = {
      id: "admin-1",
      role: "ADMIN",
      email: "a@example.com",
      pwdVersion: "1234567890",
    };
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

  it("accepts an explicit JSON null body (matches body schema { type: 'null' })", async () => {
    // Locks the schema choice: a client that sends `null` with a JSON
    // content-type should be treated identically to a bare POST. Switching
    // the schema to `{ type: "object", additionalProperties: false }` would
    // break this — that change must update this test.
    mockAutoCategorize.mockResolvedValue({ categorized: 4 });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/transactions/auto-categorize",
      headers: { "content-type": "application/json" },
      payload: "null",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ categorized: 4 });
    expect(mockAutoCategorize).toHaveBeenCalledExactlyOnceWith("user-1");
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
    sessionUser = {
      id: "user-1",
      role: "USER",
      email: "test@example.com",
      pwdVersion: "1234567890",
    };
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
    sessionUser = {
      id: "user-42",
      role: "USER",
      email: "x@example.com",
      pwdVersion: "1234567890",
    };
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
    sessionUser = {
      id: "user-1",
      role: "GUEST",
      email: "g@example.com",
      pwdVersion: "1234567890",
    };
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/transactions/${VALID_TX_ID}`,
    });
    expect(response.statusCode).toBe(403);
    expect(mockGetTransaction).not.toHaveBeenCalled();
  });

  it("allows ADMIN to call the endpoint (role hierarchy)", async () => {
    sessionUser = {
      id: "admin-1",
      role: "ADMIN",
      email: "a@example.com",
      pwdVersion: "1234567890",
    };
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
    sessionUser = {
      id: "user-1",
      role: "USER",
      email: "test@example.com",
      pwdVersion: "1234567890",
    };
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
    sessionUser = {
      id: "user-42",
      role: "USER",
      email: "x@example.com",
      pwdVersion: "1234567890",
    };
    await app.inject({
      method: "PATCH",
      url: `/api/v1/transactions/${VALID_TX_ID}`,
      payload: { notes: "hello" },
    });
    expect(mockUpdateTransaction).toHaveBeenCalledExactlyOnceWith(
      VALID_TX_ID,
      "user-42",
      {
        notes: "hello",
      },
      false,
    );
  });

  it("accepts a body containing only categoryId (the other accepted field)", async () => {
    const categoryId = "11111111-2222-3333-4444-555555555555";
    await app.inject({
      method: "PATCH",
      url: `/api/v1/transactions/${VALID_TX_ID}`,
      payload: { categoryId },
    });
    expect(mockUpdateTransaction).toHaveBeenCalledExactlyOnceWith(
      VALID_TX_ID,
      "user-1",
      {
        categoryId,
      },
      false,
    );
  });

  it("returns 400 when categoryId is not a valid UUID (schema rejection)", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/transactions/${VALID_TX_ID}`,
      payload: { categoryId: "not-a-uuid" },
    });
    expect(response.statusCode).toBe(400);
    expect(mockUpdateTransaction).not.toHaveBeenCalled();
  });

  it("returns 400 when notes exceed maxLength (schema rejection)", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/transactions/${VALID_TX_ID}`,
      payload: { notes: "x".repeat(10001) },
    });
    expect(response.statusCode).toBe(400);
    expect(mockUpdateTransaction).not.toHaveBeenCalled();
  });

  it("strips unrecognised properties from the body before calling the service (additionalProperties: false)", async () => {
    // Fastify's default ajv configuration strips unknown properties rather
    // than raising a 400. The contract is still safe — the unknown field
    // never reaches the service — but verify the stripping happens here so a
    // future ajv reconfiguration that turns this into a 400 is a deliberate
    // breaking change, not a silent regression.
    await app.inject({
      method: "PATCH",
      url: `/api/v1/transactions/${VALID_TX_ID}`,
      payload: { notes: "ok", unknownField: "no" },
    });
    expect(mockUpdateTransaction).toHaveBeenCalledExactlyOnceWith(
      VALID_TX_ID,
      "user-1",
      {
        notes: "ok",
      },
      false,
    );
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
    sessionUser = {
      id: "user-1",
      role: "GUEST",
      email: "g@example.com",
      pwdVersion: "1234567890",
    };
    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/transactions/${VALID_TX_ID}`,
      payload: { notes: "test" },
    });
    expect(response.statusCode).toBe(403);
    expect(mockUpdateTransaction).not.toHaveBeenCalled();
  });

  it("allows ADMIN to update transactions (role hierarchy)", async () => {
    sessionUser = {
      id: "admin-1",
      role: "ADMIN",
      email: "a@example.com",
      pwdVersion: "1234567890",
    };
    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/transactions/${VALID_TX_ID}`,
      payload: { notes: "admin edit" },
    });
    expect(response.statusCode).toBe(200);
    expect(mockUpdateTransaction).toHaveBeenCalledExactlyOnceWith(
      VALID_TX_ID,
      "admin-1",
      {
        notes: "admin edit",
      },
      true,
    );
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
    sessionUser = {
      id: "user-1",
      role: "USER",
      email: "test@example.com",
      pwdVersion: "1234567890",
    };
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
    sessionUser = {
      id: "user-42",
      role: "USER",
      email: "x@example.com",
      pwdVersion: "1234567890",
    };
    await app.inject({ method: "DELETE", url: `/api/v1/transactions/${VALID_TX_ID}` });
    expect(mockDeleteTransaction).toHaveBeenCalledExactlyOnceWith(
      VALID_TX_ID,
      "user-42",
      undefined,
      false,
    );
  });

  it("forwards reason from the request body to the service (not the querystring)", async () => {
    // Reason MUST come from the JSON body; the controller previously accepted
    // ?reason= on the URL, which leaked PII into Pino access logs.
    await app.inject({
      method: "DELETE",
      url: `/api/v1/transactions/${VALID_TX_ID}`,
      payload: { reason: "duplicate import" },
    });
    expect(mockDeleteTransaction).toHaveBeenCalledExactlyOnceWith(
      VALID_TX_ID,
      "user-1",
      "duplicate import",
      false,
    );
  });

  it("returns 400 when reason exceeds the maxLength (schema rejection)", async () => {
    const response = await app.inject({
      method: "DELETE",
      url: `/api/v1/transactions/${VALID_TX_ID}`,
      payload: { reason: "x".repeat(1001) },
    });
    expect(response.statusCode).toBe(400);
    expect(mockDeleteTransaction).not.toHaveBeenCalled();
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
    sessionUser = {
      id: "user-1",
      role: "GUEST",
      email: "g@example.com",
      pwdVersion: "1234567890",
    };
    const response = await app.inject({
      method: "DELETE",
      url: `/api/v1/transactions/${VALID_TX_ID}`,
    });
    expect(response.statusCode).toBe(403);
    expect(mockDeleteTransaction).not.toHaveBeenCalled();
  });

  it("allows ADMIN to delete transactions (role hierarchy)", async () => {
    sessionUser = {
      id: "admin-1",
      role: "ADMIN",
      email: "a@example.com",
      pwdVersion: "1234567890",
    };
    const response = await app.inject({
      method: "DELETE",
      url: `/api/v1/transactions/${VALID_TX_ID}`,
    });
    expect(response.statusCode).toBe(204);
    expect(mockDeleteTransaction).toHaveBeenCalledExactlyOnceWith(
      VALID_TX_ID,
      "admin-1",
      undefined,
      true,
    );
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
    sessionUser = {
      id: "user-1",
      role: "USER",
      email: "test@example.com",
      pwdVersion: "1234567890",
    };
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
    sessionUser = {
      id: "user-42",
      role: "USER",
      email: "x@example.com",
      pwdVersion: "1234567890",
    };

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
    sessionUser = {
      id: "user-1",
      role: "GUEST",
      email: "g@example.com",
      pwdVersion: "1234567890",
    };

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/transactions",
    });

    expect(response.statusCode).toBe(403);
    expect(mockListTransactions).not.toHaveBeenCalled();
  });

  it("allows ADMIN to call the endpoint (role hierarchy)", async () => {
    sessionUser = {
      id: "admin-1",
      role: "ADMIN",
      email: "a@example.com",
      pwdVersion: "1234567890",
    };

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

  it("forwards filter parameters (startDate, endDate, categoryId, minAmount, maxAmount, search) to the service", async () => {
    const categoryId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    await app.inject({
      method: "GET",
      url:
        "/api/v1/transactions" +
        "?startDate=2026-01-01&endDate=2026-03-31" +
        `&categoryId=${categoryId}` +
        "&minAmount=10.5&maxAmount=999.99" +
        "&search=coffee",
    });

    expect(mockListTransactions).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        startDate: "2026-01-01",
        endDate: "2026-03-31",
        categoryId,
        minAmount: 10.5,
        maxAmount: 999.99,
        search: "coffee",
      }),
    );
  });

  it("returns 400 when startDate does not match the YYYY-MM-DD pattern", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/transactions?startDate=2026/01/01",
    });
    expect(response.statusCode).toBe(400);
    expect(mockListTransactions).not.toHaveBeenCalled();
  });

  it("returns 400 when endDate does not match the YYYY-MM-DD pattern", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/transactions?endDate=31-12-2026",
    });
    expect(response.statusCode).toBe(400);
    expect(mockListTransactions).not.toHaveBeenCalled();
  });

  it("returns 400 when search exceeds the 200-character maxLength", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/transactions?search=${"q".repeat(201)}`,
    });
    expect(response.statusCode).toBe(400);
    expect(mockListTransactions).not.toHaveBeenCalled();
  });

  it("returns 400 when limit exceeds the maximum of 100", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/transactions?limit=101",
    });
    expect(response.statusCode).toBe(400);
    expect(mockListTransactions).not.toHaveBeenCalled();
  });

  it("returns 400 when page is below the minimum of 1", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/transactions?page=0",
    });
    expect(response.statusCode).toBe(400);
    expect(mockListTransactions).not.toHaveBeenCalled();
  });

  it("returns 400 when minAmount is not a number", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/transactions?minAmount=abc",
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
    sessionUser = {
      id: "user-1",
      role: "USER",
      email: "test@example.com",
      pwdVersion: "1234567890",
    };
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
    sessionUser = {
      id: "user-1",
      role: "GUEST",
      email: "g@example.com",
      pwdVersion: "1234567890",
    };

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

  it("returns 200 with the import result on a valid multipart upload", async () => {
    mockImportTransactions.mockResolvedValue({ imported: 3, categorized: 2 });
    const { payload, headers } = buildMultipart(
      "file",
      "transactions.csv",
      "Date,Amount,Description\n2026-01-01,12.34,Coffee\n",
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/transactions/import?accountId=acc-1&format=neon",
      headers,
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ imported: 3, categorized: 2 });
    expect(mockImportTransactions).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        format: "neon",
        accountId: "acc-1",
        userId: "user-1",
        csvText: expect.stringContaining("Coffee"),
      }),
    );
  });

  it("forwards the session user id (not a request param) to the import service", async () => {
    // IDOR guard for the import endpoint: the user id passed to the service
    // must always come from the authenticated session, never from any
    // client-controlled input.
    sessionUser = {
      id: "user-77",
      role: "USER",
      email: "y@example.com",
      pwdVersion: "1234567890",
    };
    mockImportTransactions.mockResolvedValue({ imported: 1, categorized: 0 });
    const { payload, headers } = buildMultipart("file", "tx.csv", "Date,Amount\n");

    await app.inject({
      method: "POST",
      url: "/api/v1/transactions/import?accountId=acc-1&format=neon",
      headers,
      payload,
    });

    expect(mockImportTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-77" }),
    );
  });

  it("returns 200 with categorized: 0 when the service reports a categorization failure", async () => {
    // Locks the documented best-effort contract from API.md / import.service.ts:
    // when the post-import auto-categorize step fails, the import still
    // succeeds and the response carries `categorized: 0`. The controller
    // must surface this verbatim, not turn it into a 5xx.
    mockImportTransactions.mockResolvedValue({ imported: 5, categorized: 0 });
    const { payload, headers } = buildMultipart("file", "tx.csv", "Date,Amount\n");

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/transactions/import?accountId=acc-1&format=neon",
      headers,
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ imported: 5, categorized: 0 });
  });

  it("propagates ServiceError(404) from the import service (e.g. account not found)", async () => {
    mockImportTransactions.mockRejectedValue(new ServiceError(404, "Account not found"));
    const { payload, headers } = buildMultipart("file", "tx.csv", "Date,Amount\n");

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/transactions/import?accountId=missing&format=neon",
      headers,
      payload,
    });

    expect(response.statusCode).toBe(404);
    expect(mockImportTransactions).toHaveBeenCalledOnce();
  });

  it("propagates ServiceError(422) from the import service (validation failure)", async () => {
    mockImportTransactions.mockRejectedValue(new ServiceError(422, "Validation failed"));
    const { payload, headers } = buildMultipart("file", "tx.csv", "garbage\n");

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/transactions/import?accountId=acc-1&format=neon",
      headers,
      payload,
    });

    expect(response.statusCode).toBe(422);
  });

  it("returns 400 when the multipart body has no file part", async () => {
    // No `filename` attribute → @fastify/multipart treats the part as a
    // regular field; `request.file()` resolves to undefined → controller
    // throws ServiceError(400, "No file uploaded").
    const boundary = "----noFileBoundary";
    const body =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="notAFile"\r\n\r\n` +
      `just-a-string\r\n` +
      `--${boundary}--\r\n`;

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/transactions/import?accountId=acc-1&format=neon",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });

    expect(response.statusCode).toBe(400);
    expect(mockImportTransactions).not.toHaveBeenCalled();
  });
});
