import type { Prisma } from "@prisma/client";
import * as auditRepository from "../repositories/audit.repository.js";
import { getLogger } from "../logger.js";

export interface AuditEventParams {
  action: string;
  userId?: string | null | undefined;
  transactionId?: string | null | undefined;
  previousValues?: Record<string, unknown> | null | undefined;
  changedValues?: Record<string, unknown> | null | undefined;
  reason?: string | null | undefined;
}

/**
 * Best-effort audit write. Swallows failures and logs them so the caller's
 * business path is never blocked by an audit-table outage. Use for
 * telemetry-grade events (LOGIN_FAILED, SESSION_INVALIDATED, LOGOUT,
 * LOGIN_SUCCESS, PROFILE_UPDATED) where a missing row is acceptable.
 *
 * The error log intentionally omits `previousValues`/`changedValues`/`reason`
 * — those may contain PII (emails, target user ids, free-text reasons) and
 * the audit table is the sole place that storage is allowed.
 */
export async function logEvent(params: AuditEventParams) {
  try {
    return await auditRepository.createAuditLog(params);
  } catch (err) {
    getLogger().error(
      {
        err,
        action: params.action,
        userId: params.userId,
        transactionId: params.transactionId,
      },
      "Failed to write to audit log",
    );
  }
}

/**
 * Strict audit write. Rethrows on failure so the surrounding `prisma.$transaction`
 * rolls back the mutation it documents. Use for security/compliance events
 * (TRANSACTION_EDIT, TRANSACTION_DELETE, ROLE_CHANGED, PASSWORD_RESET,
 * PASSWORD_CHANGED, USER_DELETED, USER_CREATED) where losing the audit row
 * silently is unacceptable. Pass the active `tx` so the audit row is atomic
 * with the mutation.
 */
export async function logEventCritical(params: AuditEventParams, tx?: Prisma.TransactionClient) {
  return auditRepository.createAuditLog(params, tx);
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
