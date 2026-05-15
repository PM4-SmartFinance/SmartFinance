import * as auditRepository from "../repositories/audit.repository.js";
import { getLogger } from "../logger.js";

export async function logEvent(params: {
  action: string;
  userId?: string | null | undefined;
  transactionId?: string | null | undefined;
  previousValues?: Record<string, unknown> | null | undefined;
  changedValues?: Record<string, unknown> | null | undefined;
  reason?: string | null | undefined;
}) {
  try {
    return await auditRepository.createAuditLog(params);
  } catch (err) {
    getLogger().error({ err, ...params }, "Failed to write to audit log");
  }
}

export async function getAuditLogs(params: {
  page: number;
  limit: number;
  userId?: string | undefined;
  action?: string | undefined;
  transactionId?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
}) {
  const { page, limit, userId, action, transactionId, startDate, endDate } = params;

  const result = await auditRepository.findAuditLogs({
    skip: (page - 1) * limit,
    take: limit,
    userId,
    action,
    transactionId,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
  });

  return {
    data: result.logs,
    meta: {
      totalCount: result.total,
      totalPages: Math.ceil(result.total / limit),
      page,
      limit,
    },
  };
}
