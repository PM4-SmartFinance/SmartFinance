import type { FastifyInstance } from "fastify";
import { requireRole } from "../middleware/rbac.js";
import * as dashboardService from "../services/dashboard.service.js";

interface DashboardQuery {
  startDate: string;
  endDate: string;
}

const dashboardQuerySchema = {
  type: "object",
  required: ["startDate", "endDate"],
  properties: {
    startDate: {
      type: "string",
      pattern: "^\\d{4}-\\d{2}-\\d{2}$",
    },
    endDate: {
      type: "string",
      pattern: "^\\d{4}-\\d{2}-\\d{2}$",
    },
  },
} as const;

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: DashboardQuery }>(
    "/dashboard/summary",
    { preHandler: requireRole("USER"), schema: { querystring: dashboardQuerySchema } },
    async (request, reply) => {
      const session = request.session.get("user")!;
      const summary = await dashboardService.getDashboardSummary(
        session.id,
        request.query.startDate,
        request.query.endDate,
      );
      return reply.send(summary);
    },
  );

  app.get<{ Querystring: DashboardQuery }>(
    "/dashboard/trends",
    { preHandler: requireRole("USER"), schema: { querystring: dashboardQuerySchema } },
    async (request, reply) => {
      const session = request.session.get("user")!;
      const trends = await dashboardService.getDashboardTrends(
        session.id,
        request.query.startDate,
        request.query.endDate,
      );
      return reply.send(trends);
    },
  );

  app.get<{ Querystring: DashboardQuery }>(
    "/dashboard/categories",
    { preHandler: requireRole("USER"), schema: { querystring: dashboardQuerySchema } },
    async (request, reply) => {
      const session = request.session.get("user")!;
      const categories = await dashboardService.getDashboardCategories(
        session.id,
        request.query.startDate,
        request.query.endDate,
      );
      return reply.send(categories);
    },
  );
}
