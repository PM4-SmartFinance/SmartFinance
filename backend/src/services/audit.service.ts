import * as auditRepository from "../repositories/audit.repository.js";

export async function logEvent(params: {
  action: string;
  userId?: string | null;
  transactionId?: string | null;
  previousValues?: Record<string, unknown> | null;
  changedValues?: Record<string, unknown> | null;
  reason?: string | null;
}) {
  return auditRepository.createAuditLog(params);
}

export async function getAuditLogs(params: {
  page: number;
  limit: number;
  userId?: string;
  action?: string;
  transactionId?: string;
  startDate?: string;
  endDate?: string;
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
