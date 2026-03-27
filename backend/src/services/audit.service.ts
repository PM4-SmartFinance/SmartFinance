import * as auditRepo from "../repositories/audit.repository.js";
import { getLogger } from "../logger.js";

export async function logEvent(
  action: string,
  userId: string | null,
  details?: Record<string, unknown> | null,
) {
  try {
    await auditRepo.createAuditLog({
      action,
      userId: userId ?? null,
      details: details ? JSON.stringify(details) : null,
    });
  } catch (err) {
    getLogger().error({ err, action, userId }, "Failed to write to audit log");
  }
}
