/// <reference types="vitest/globals" />

import { vi } from "vitest";
import type { FastifyRequest } from "fastify";
import { ServiceError } from "../errors.js";

vi.mock("../services/dashboard.service.js", () => ({
  getDashboardSummary: vi.fn(),
}));

const mockRequireRole = vi.fn();
vi.mock("../middleware/rbac.js", () => ({
  requireRole: (role: string) => mockRequireRole(role),
}));

import { buildApp } from "../app.js";
import * as dashboardService from "../services/dashboard.service.js";

const mockService = vi.mocked(dashboardService);

const MOCK_USER = { id: "user-1", role: "USER", email: "test@example.com" };

beforeEach(() => {
  vi.clearAllMocks();
  // Default: authenticated — preHandler injects user into session
  mockRequireRole.mockReturnValue(async (request: FastifyRequest) => {
    request.session.set("user", MOCK_USER);
  });
});

describe("GET /api/v1/dashboard/summary", () => {
  describe("authentication", () => {
    it("returns 401 when the preHandler rejects the request", async () => {
      mockRequireRole.mockReturnValue(async () => {
        throw new ServiceError(401, "Unauthorized");
      });

      const app = await buildApp();
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/dashboard/summary?startDate=2025-01-01&endDate=2025-01-31",
      });
      await app.close();

      expect(response.statusCode).toBe(401);
    });
  });

  describe("input validation", () => {
    it("returns 400 when startDate is missing", async () => {
      const app = await buildApp();
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/dashboard/summary?endDate=2025-01-31",
      });
      await app.close();

      expect(response.statusCode).toBe(400);
    });

    it("returns 400 when endDate is missing", async () => {
      const app = await buildApp();
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/dashboard/summary?startDate=2025-01-01",
      });
      await app.close();

      expect(response.statusCode).toBe(400);
    });

    it("returns 400 when startDate format is invalid", async () => {
      const app = await buildApp();
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/dashboard/summary?startDate=not-a-date&endDate=2025-01-31",
      });
      await app.close();

      expect(response.statusCode).toBe(400);
    });

    it("returns 400 when endDate format is invalid", async () => {
      const app = await buildApp();
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/dashboard/summary?startDate=2025-01-01&endDate=2025-1-1",
      });
      await app.close();

      expect(response.statusCode).toBe(400);
    });
  });

  describe("success", () => {
    it("returns 200 with the summary shape", async () => {
      mockService.getDashboardSummary.mockResolvedValue({
        totalIncome: 1500,
        totalExpenses: -800,
        netBalance: 700,
        transactionCount: 5,
      });

      const app = await buildApp();
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/dashboard/summary?startDate=2025-01-01&endDate=2025-01-31",
      });
      await app.close();

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

      const app = await buildApp();
      await app.inject({
        method: "GET",
        url: "/api/v1/dashboard/summary?startDate=2025-06-01&endDate=2025-06-30",
      });
      await app.close();

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

      const app = await buildApp();
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/dashboard/summary?startDate=2025-01-01&endDate=2025-01-31",
      });
      await app.close();

      expect(response.statusCode).toBe(400);
    });
  });
});
