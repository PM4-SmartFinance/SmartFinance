/// <reference types="vitest/globals" />

import { vi } from "vitest";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { ServiceError } from "../errors.js";

vi.mock("../services/dashboard.service.js", () => ({
  getDashboardSummary: vi.fn(),
}));

// Mutable flag: controls whether the preHandler simulates auth failure.
// The preHandler closure captures this reference so its behavior can change
// per-test without rebuilding the app.
let rejectAuth = false;

vi.mock("../middleware/rbac.js", () => ({
  requireRole: () => async (request: FastifyRequest) => {
    if (rejectAuth) throw new ServiceError(401, "Unauthorized");
    request.session.set("user", { id: "user-1", role: "USER", email: "test@example.com" });
  },
  requireOwnerOrAdmin: () => async (request: FastifyRequest) => {
    if (rejectAuth) throw new ServiceError(401, "Unauthorized");
    request.session.set("user", { id: "user-1", role: "USER", email: "test@example.com" });
  },
}));

import { buildApp } from "../app.js";
import * as dashboardService from "../services/dashboard.service.js";

const mockService = vi.mocked(dashboardService);

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  rejectAuth = false;
});

describe("GET /api/v1/dashboard/summary", () => {
  describe("authentication", () => {
    it("returns 401 when requireRole rejects the request", async () => {
      rejectAuth = true;

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/dashboard/summary?startDate=2025-01-01&endDate=2025-01-31",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("input validation", () => {
    it("returns 400 when startDate is missing", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/dashboard/summary?endDate=2025-01-31",
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 400 when endDate is missing", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/dashboard/summary?startDate=2025-01-01",
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 400 when startDate format is invalid", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/dashboard/summary?startDate=not-a-date&endDate=2025-01-31",
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 400 when endDate format is invalid", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/dashboard/summary?startDate=2025-01-01&endDate=2025-1-1",
      });

      expect(response.statusCode).toBe(400);
    });

    // Note: Fastify 5 strips unknown query params (AJV removeAdditional:true by default)
    // rather than rejecting them. additionalProperties:false still protects the handler
    // from seeing unknown props, but does not produce a 400.
  });

  describe("success", () => {
    it("returns 200 with the summary shape", async () => {
      mockService.getDashboardSummary.mockResolvedValue({
        totalIncome: 1500,
        totalExpenses: -800,
        netBalance: 700,
        transactionCount: 5,
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/dashboard/summary?startDate=2025-01-01&endDate=2025-01-31",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        totalIncome: 1500,
        totalExpenses: -800,
        netBalance: 700,
        transactionCount: 5,
      });
    });

    it("passes userId from session and date params to the service", async () => {
      mockService.getDashboardSummary.mockResolvedValue({
        totalIncome: 0,
        totalExpenses: 0,
        netBalance: 0,
        transactionCount: 0,
      });

      await app.inject({
        method: "GET",
        url: "/api/v1/dashboard/summary?startDate=2025-06-01&endDate=2025-06-30",
      });

      expect(mockService.getDashboardSummary).toHaveBeenCalledWith(
        "user-1",
        "2025-06-01",
        "2025-06-30",
      );
    });

    it("returns 400 when the service throws a ServiceError", async () => {
      mockService.getDashboardSummary.mockRejectedValue(
        new ServiceError(400, "startDate must not be after endDate"),
      );

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/dashboard/summary?startDate=2025-01-01&endDate=2025-01-31",
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
