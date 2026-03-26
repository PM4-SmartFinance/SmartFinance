import type { FastifyBaseLogger } from "fastify";

import * as auditRepo from "../repositories/audit.repository.js";

export async function logEvent(
  action: string,
  userId: string | null,
  details?: Record<string, unknown> | null,
  logger?: FastifyBaseLogger,
) {
  try {
    await auditRepo.createAuditLog({
      action,
      userId: userId ?? null,
      details: details ? JSON.stringify(details) : null,
    });
  } catch (err) {
    // Use Fastify logger when available to produce structured logs
    if (logger) {
      logger.error({ err, action, userId }, "Failed to write to audit log");
    } else {
      console.error("Failed to write to audit log:", err);
    }
  }
}
