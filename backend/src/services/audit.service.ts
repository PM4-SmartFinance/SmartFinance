import { prisma } from "../prisma.js";

export async function logEvent(
  action: string,
  userId: string | null,
  details?: Record<string, unknown> | null,
) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        userId: userId ?? null,
        details: details ? JSON.stringify(details) : null,
      },
    });
  } catch (err) {
    // In production, we might want to log this to a file logger (e.g., pino) or a monitoring service
    console.error("Failed to write to audit log:", err);
  }
}
