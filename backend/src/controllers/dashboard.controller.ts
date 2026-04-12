import type { FastifyInstance } from "fastify";
import { requireRole } from "../middleware/rbac.js";
import * as dashboardService from "../services/dashboard.service.js";

interface DashboardSummaryQuery {
  startDate: string;
  endDate: string;
}

const dashboardSummaryQuerySchema = {
  type: "object",
  required: ["startDate", "endDate"],
  additionalProperties: false,
  properties: {
    startDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    endDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
  },
} as const;

interface DashboardTrendsQuery {
  startDate: string;
  endDate: string;
}

const dashboardTrendsQuerySchema = {
  type: "object",
  required: ["startDate", "endDate"],
  additionalProperties: false,
  properties: {
    startDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    endDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
  },
} as const;

const dashboardTrendsResponseSchema = {
  200: {
    type: "object",
    properties: {
      data: {
        type: "array",
        items: {
          type: "object",
          properties: {
            year: { type: "number" },
            month: { type: "number" },
            income: { type: "number" },
            expenses: { type: "number" },
          },
          required: ["year", "month", "income", "expenses"],
        },
      },
    },
    required: ["data"],
  },
} as const;

const dashboardCategoriesResponseSchema = {
  200: {
    type: "array",
    items: {
      type: "object",
      properties: {
        categoryId: { type: "string" },
        categoryName: { type: "string" },
        total: { type: "number" },
      },
      required: ["categoryId", "categoryName", "total"],
    },
  },
} as const;

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: DashboardSummaryQuery }>(
    "/dashboard/summary",
    {
      preHandler: requireRole("USER"),
      schema: { querystring: dashboardSummaryQuerySchema },
    },
    async (request, reply) => {
      // session is guaranteed non-null: requireRole preHandler rejects unauthenticated requests
      const session = request.session.get("user")!;
      const { startDate, endDate } = request.query;
      const summary = await dashboardService.getDashboardSummary(session.id, startDate, endDate);
      return reply.send(summary);
    },
  );

  app.get<{ Querystring: DashboardSummaryQuery }>(
    "/dashboard/categories",
    {
      preHandler: requireRole("USER"),
      schema: {
        querystring: dashboardSummaryQuerySchema,
        response: dashboardCategoriesResponseSchema,
      },
    },
    async (request, reply) => {
      const session = request.session.get("user")!;
      const { startDate, endDate } = request.query;
      const data = await dashboardService.getDashboardCategories(session.id, startDate, endDate);
      return reply.send(data);
    },
  );

  app.get<{ Querystring: DashboardTrendsQuery }>(
    "/dashboard/trends",
    {
      preHandler: requireRole("USER"),
      schema: { querystring: dashboardTrendsQuerySchema, response: dashboardTrendsResponseSchema },
    },
    async (request, reply) => {
      const session = request.session.get("user")!;
      const { startDate, endDate } = request.query;
      const data = await dashboardService.getDashboardTrends(session.id, startDate, endDate);
      return reply.send({ data });
    },
  );
}
