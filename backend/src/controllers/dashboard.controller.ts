import type { FastifyInstance } from "fastify";
import { requireRole } from "../middleware/rbac.js";
import * as dashboardService from "../services/dashboard.service.js";
import { ServiceError } from "../errors.js";

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

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: DashboardSummaryQuery }>(
    "/dashboard/summary",
    {
      preHandler: requireRole("USER"),
      schema: { querystring: dashboardSummaryQuerySchema },
    },
    async (request, reply) => {
      const session = request.session.get("user");
      if (!session) {
        throw new ServiceError(401, "Unauthorized");
      }
      const { startDate, endDate } = request.query;
      const summary = await dashboardService.getDashboardSummary(session.id, startDate, endDate);
      return reply.send(summary);
    },
  );
}
