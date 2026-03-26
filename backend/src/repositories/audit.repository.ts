// ...existing code...
import { prisma } from "../prisma.js";

export async function createAuditLog(data: {
  action: string;
  userId?: string | null;
  details?: string | null;
}) {
  return prisma.auditLog.create({ data });
}

export async function findFirstAuditLog(where: Record<string, unknown>) {
  return prisma.auditLog.findFirst({ where });
}
