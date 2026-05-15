import type { FastifyInstance } from "fastify";
import { requireRole } from "../middleware/rbac.js";
import * as auditService from "../services/audit.service.js";

const listAuditLogsSchema = {
  querystring: {
    type: "object",
    properties: {
      page: { type: "integer", minimum: 1, default: 1 },
      limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      userId: { type: "string" },
      action: { type: "string" },
      transactionId: { type: "string" },
      startDate: { type: "string", format: "date-time" },
      endDate: { type: "string", format: "date-time" },
    },
  },
} as const;

interface AuditLogQuery {
  page: number;
  limit: number;
  userId?: string;
  action?: string;
  transactionId?: string;
  startDate?: string;
  endDate?: string;
}

export async function auditRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: AuditLogQuery }>(
    "/audit-logs",
    {
      schema: listAuditLogsSchema,
      preHandler: requireRole("ADMIN"),
    },
    async (request, reply) => {
      const { page, limit, userId, action, transactionId, startDate, endDate } = request.query;

      const result = await auditService.getAuditLogs({
        page,
        limit,
        userId,
        action,
        transactionId,
        startDate,
        endDate,
      });

      return reply.send(result);
    },
  );
}
